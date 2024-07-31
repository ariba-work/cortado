import asyncio
from collections import Counter
from json import dumps

from cortado_core.alignments.unfolding.algorithm import unfold_sync_net
from cortado_core.utils.constants import PartialOrderMode
from cortado_core.utils.petri_net_utils import get_partial_trace_net_from_trace
from pm4py import convert_to_petri_net, save_vis_petri_net
from pm4py.objects.petri_net.utils.align_utils import SKIP

from cortado_core.utils.sequentializations import generate_sequentializations
from cortado_core.utils.split_graph import Group
from cortado_core.utils.process_tree import LabelWithIndex
from starlette.websockets import WebSocketState

from backend_utilities.configuration.repository import ConfigurationRepositoryFactory
from backend_utilities.timeout.helper_functions import (
    TimeoutException,
    execute_with_timeout,
)
from backend_utilities.process_tree_conversion import dict_to_process_tree
from endpoints.alignments import InfixType
from endpoints.alignments import calculate_alignment as calculate_alignment_endpoint
from fastapi import WebSocket
from pm4py.objects.petri_net.utils.synchronous_product import construct as construct_synchronous_product


def calculate_alignment_intern_with_timeout(
    data, variants, timeout:int,
):
    print(timeout)
    try:
        if data["method"] == 'unfolding':
            return execute_with_timeout(
                calculate_palignment_intern, timeout, args=(data["pt"], variants[data["bid"]], data["bid"])
            )
        else:
            return execute_with_timeout(
                calculate_alignment_intern, timeout, args=(data["pt"], data["variant"],  InfixType(data["infixType"]))
            )
    except TimeoutException:
        return {"isTimeout": True}


def calculate_palignment_intern(pt: dict, variant, bid):

    trace = variant[1][0]

    model_net, model_im, model_fm = convert_to_petri_net(dict_to_process_tree(pt)[0])

    save_vis_petri_net(model_net, model_im, model_fm, f'model_net.png')

    # build trace net
    trace_net, im, fm = get_partial_trace_net_from_trace(trace, PartialOrderMode.REDUCTION, False)

    # build SPN
    sync_prod, sync_im, sync_fm = construct_synchronous_product(trace_net, im, fm, model_net, model_im, model_fm, SKIP)

    alignment_result = unfold_sync_net(sync_prod, sync_im, sync_fm, bid=bid)
    v_log, v_model = alignment_result["alignments"][0]

    return {
        "deviations": alignment_result["deviations"],
        "alignment": v_model,
        "pt": pt,
        "cost": alignment_result["costs"],
        "variant": v_log,
        "deviation_deps": alignment_result["deviation_deps"],
    }


def calculate_alignment_intern(pt: dict, c_variant: dict, infix_type: InfixType):
    def index_leafs(variant, indices=None):
        if indices is None:
            indices = Counter()
        if "follows" in variant:
            res = {"follows": []}
            for v in variant["follows"]:
                childs = index_leafs(v, indices)
                res["follows"].append(childs)
            return res
        elif "parallel" in variant:
            res = {"parallel": []}
            for v in variant["parallel"]:
                childs = index_leafs(v, indices)
                res["parallel"].append(childs)
            return res
        else:
            leafs = []
            for activity in variant["leaf"]:
                leafs.append(LabelWithIndex(activity, indices[activity]))
                indices[activity] += 1
            return {"leaf": leafs}

    c_variant_indexed = index_leafs(c_variant)

    config = (
        ConfigurationRepositoryFactory().get_config_repository().get_configuration()
    )
    n_sequentializations = (
        -1
        if not config.is_n_sequentialization_reduction_enabled
        else config.number_of_sequentializations_per_variant
    )
    all_variants = generate_sequentializations(
        Group.deserialize(c_variant_indexed), n_sequentializations=n_sequentializations
    )
    index_alignments_mapping = Counter()
    total_cost = 0
    deviations = 0
    for variant in all_variants:
        alignment = calculate_alignment_endpoint(
            variant, dict_to_process_tree(pt)[0], infix_type
        )
        total_cost += alignment["cost"]
        deviations += alignment["deviation"]
        for log_move, model_move in alignment["alignment"]:
            if log_move == ">>":
                continue
            index_alignments_mapping[log_move.full] += str(log_move) == str(model_move)

    if len(all_variants) > 1:
        index_alignments_mapping = {
            k: v / len(all_variants) for k, v in index_alignments_mapping.items()
        }

    return {
        "cost": total_cost / len(all_variants),
        "deviations": deviations / len(all_variants),
        "alignment": project_alignments_on_cvariant(
            index_alignments_mapping, c_variant_indexed
        ),
        "pt": pt,
    }


def project_alignments_on_cvariant(mapping, variant):
    if "follows" in variant:
        res = {"follows": []}
        for v in variant["follows"]:
            childs = project_alignments_on_cvariant(mapping, v)
            res["follows"].append(childs)
        return res
    elif "parallel" in variant:
        res = {"parallel": []}
        for v in variant["parallel"]:
            childs = project_alignments_on_cvariant(mapping, v)
            res["parallel"].append(childs)
        return res
    else:
        return {"leaf": [(str(act), mapping[act.full]) for act in variant["leaf"]]}


def get_alignment_callback(idx: str, alignType, websocket: WebSocket):
    def callback(result):

        data = {
            "id": idx,
            "isTimeout": False,
            "cost": 0,
            "type": alignType,
            "deviation": False,
        }
        for key, value in result.items():
            if key == 'deviation_deps':
                data[key] = [dep.serialize() for dep in value]
            else:
                data[key] = value

        if websocket.application_state == WebSocketState.CONNECTED:
            asyncio.run(websocket.send_json(data))

    return callback
