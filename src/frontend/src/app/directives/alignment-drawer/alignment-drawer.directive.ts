import { VARIANT_Constants } from './../../constants/variant_element_drawer_constants';

import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import * as d3 from 'd3';
import { Selection } from 'd3';
import { PolygonGeneratorService } from 'src/app/services/polygon-generator.service';
import { SharedDataService } from 'src/app/services/sharedDataService/shared-data.service';
import {
  getLowestSelectionActionableElement,
  InfixType,
  SelectableState,
} from 'src/app/objects/Variants/infix_selection';
import {
  ChoiceGroup,
  FallthroughGroup,
  InvisibleSequenceGroup,
  LeafNode,
  LoopGroup,
  ParallelGroup,
  SequenceGroup,
  SkipGroup,
  VariantElement,
  WaitingTimeNode,
} from 'src/app/objects/Variants/variant_element';
import { textColorForBackgroundColor } from 'src/app/utils/render-utils';
import { ViewMode } from 'src/app/objects/ViewMode';
import { VariantViewModeService } from 'src/app/services/viewModeServices/variant-view-mode.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IVariant } from 'src/app/objects/Variants/variant_interface';
import { ConformanceCheckingService } from 'src/app/services/conformanceChecking/conformance-checking.service';
import { VariantService } from '../../services/variantService/variant.service';
import { VariantVisualisationComponent } from '../../components/variant-explorer/variant/subcomponents/variant-visualisation/variant-visualisation.component';

@Directive({
  selector: '[appAlignmentDrawer]',
  exportAs: 'alignmentDrawer',
})
export class AlignmentDrawerDirective
  implements AfterViewInit, OnChanges, OnDestroy
{
  setExpanded(expanded: boolean) {
    this.variant.variant.setExpanded(expanded);
    this.variant.alignment?.setExpanded(expanded);
    this.redraw();
  }

  constructor(
    elRef: ElementRef<HTMLElement>,
    private polygonService: PolygonGeneratorService,
    private sharedDataService: SharedDataService, //edited
    private variantViewModeService: VariantViewModeService,
    private conformanceCheckingService: ConformanceCheckingService,
    private variantService: VariantService,
    private variantVisualisationComponent: VariantVisualisationComponent
  ) {
    this.svgHtmlElement = elRef;
  }

  svgHtmlElement: ElementRef;

  @Input()
  variant: IVariant;

  @Input()
  traceInfixSelectionMode: boolean = false;

  @Input()
  infixType: InfixType;

  @Input()
  computeActivityColor: (
    drawerDirective: AlignmentDrawerDirective,
    element: VariantElement,
    variant: IVariant
  ) => string;

  @Input()
  onClickCbFc: (
    drawerDirective: AlignmentDrawerDirective,
    element: VariantElement,
    variant: IVariant
  ) => void;

  @Input()
  onMouseOverCbFc: (
    drawerDirective: AlignmentDrawerDirective,
    element: VariantElement,
    variant: IVariant,
    selection
  ) => void;

  @Input()
  onRightMouseClickCbFc: (
    drawerDirective: AlignmentDrawerDirective,
    element: VariantElement,
    variant: IVariant,
    event: Event
  ) => void;

  @Input()
  keepStandardView: boolean = false;

  @Input()
  addCursorPointer: boolean = true;

  @Output()
  selection = new EventEmitter<Selection<any, any, any, any>>();

  @Output() redrawArcsIfComputed = new EventEmitter();

  svgSelection!: Selection<any, any, any, any>;

  private _destroy$ = new Subject();

  ngAfterViewInit(): void {
    this.svgSelection = d3.select(this.svgHtmlElement.nativeElement);

    this.svgSelection = this.svgSelection
      .append('g')
      .style('padding-top', '5px');

    this.redraw();

    this.variantViewModeService.viewMode$
      .pipe(takeUntil(this._destroy$))
      .subscribe((viewMode: ViewMode) => {
        this.redraw();
        this.setInspectVariant();
      });

    this.redrawArcsIfComputed.emit();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes.variant &&
      !changes.variant.firstChange &&
      changes.variant.currentValue
    ) {
      this.redraw();
    } else if (
      changes.infixType &&
      !changes.infixType.firstChange &&
      changes.infixType.currentValue
    ) {
      this.redraw();
    } else if (
      changes.traceInfixSelectionMode &&
      (!changes.variant || !changes.variant.firstChange)
    ) {
      this.redraw();
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
  }

  redraw(): void {
    this.svgSelection.selectAll('*').remove();
    const height = this.variant.alignment.recalculateHeight(false);
    const width = this.variant.alignment.recalculateWidth(false);

    const svg_container = d3.select(this.svgHtmlElement.nativeElement);
    this.variant.alignment.updateWidth(
      !this.keepStandardView &&
        this.variantViewModeService.viewMode === ViewMode.PERFORMANCE
    );

    const [svg, width_offset] = this.handleInfix(this.infixType, height, width);

    svg_container
      .attr('width', width + width_offset)
      .attr('height', height + 2 * VARIANT_Constants.SELECTION_STROKE_WIDTH);

    this.draw(this.variant.alignment, svg, true);

    if (this.variant.alignment instanceof SequenceGroup) {
      this.svgSelection.select('polygon').style('fill', 'transparent');
    }

    this.selection.emit(this.svgSelection);
  }

  private handleInfix(infixType, height: number, width: number): [any, number] {
    let width_offset = 0;

    const PREFIX_OFFSET = 35;
    const POSTFIX_OFFSET = 25;

    const svg = this.svgSelection;
    const variant_svg = svg
      .append('g')
      .attr('width', width)
      .attr('height', height);

    const height_offset = (height - 2 * VARIANT_Constants.MARGIN_Y) / 2 - 7.65;
    switch (infixType) {
      case InfixType.NOT_AN_INFIX:
        break;

      case InfixType.POSTFIX:
        width_offset = POSTFIX_OFFSET;
        break;

      case InfixType.PREFIX:
        width_offset = PREFIX_OFFSET;
        break;

      case InfixType.PROPER_INFIX:
        width_offset = PREFIX_OFFSET + POSTFIX_OFFSET;
        break;
    }

    svg.attr('width', width + width_offset).attr('height', height);

    if (
      infixType === InfixType.POSTFIX ||
      infixType === InfixType.PROPER_INFIX
    ) {
      variant_svg.attr(
        'transform',
        `translate(${PREFIX_OFFSET}, ${VARIANT_Constants.SELECTION_STROKE_WIDTH})`
      );

      svg
        .append('g')
        .attr('transform', `translate(0, ${height_offset})`)
        .append('use')
        .attr('href', '#infixDots')
        .attr('transform', 'scale(1.7)');
    } else {
      variant_svg.attr(
        'transform',
        `translate(0, ${VARIANT_Constants.SELECTION_STROKE_WIDTH})`
      );
    }

    if (
      infixType === InfixType.PREFIX ||
      infixType === InfixType.PROPER_INFIX
    ) {
      svg
        .append('g')
        .attr(
          'transform',
          `translate(${
            width + (infixType === InfixType.PROPER_INFIX ? PREFIX_OFFSET : 0)
          }, ${height_offset})`
        )
        .append('use')
        .attr('href', '#infixDots')
        .attr('transform', 'scale(1.7)');
    }

    return [variant_svg, width_offset];
  }

  draw(
    element: VariantElement,
    svgElement: Selection<any, any, any, any>,
    outerElement: boolean = false
  ): void {
    svgElement.datum(element).classed('variant-element-group', true);

    if (element instanceof ParallelGroup) {
      this.drawParallelGroup(element.asParallelGroup(), svgElement);
    } else if (element instanceof ChoiceGroup) {
      this.drawChoiceGroup(element.asChoiceGroup(), svgElement);
    } else if (element instanceof FallthroughGroup) {
      this.drawFallthroughGroup(element.asFallthroughGroup(), svgElement);
    } else if (element instanceof SequenceGroup) {
      this.drawSequenceGroup(
        element.asSequenceGroup(),
        svgElement,
        outerElement
      );
    } else if (element instanceof LeafNode) {
      this.drawLeafNode(element.asLeafNode(), svgElement);
    } else if (element instanceof WaitingTimeNode) {
      this.drawWaitingNode(element.asLeafNode(), svgElement);
    } else if (element instanceof LoopGroup) {
      this.drawLoopGroup(element.asLoopGroup(), svgElement);
    } else if (element instanceof SkipGroup) {
      this.drawSkipGroup(element.asSkipGroup(), svgElement);
    }
  }

  public drawLoopGroup(
    loopGroup: LoopGroup,
    parent: Selection<any, any, any, any>
  ): void {
    const width = loopGroup.getWidth();
    const height = loopGroup.getHeight();

    let leafNode = loopGroup.elements[0].asLeafNode();

    const polygonPoints = this.polygonService.getPolygonPoints(width, height);

    const color = this.computeActivityColor(this, leafNode, this.variant);

    let laElement = getLowestSelectionActionableElement(loopGroup);
    let actionable =
      laElement.parent !== null &&
      laElement.infixSelectableState !== SelectableState.None;

    let polygon = this.createPolygon(parent, polygonPoints, color, actionable);

    if (this.traceInfixSelectionMode) {
      this.addInfixSelectionAttributes(loopGroup, polygon, true);
    }

    if (this.onClickCbFc) {
      parent.on('click', (e: PointerEvent) => {
        this.onVariantClick(loopGroup);
        e.stopPropagation();
      });
    }

    const textcolor = textColorForBackgroundColor(
      color,
      this.traceInfixSelectionMode && !loopGroup.selected
    );

    const activityText = parent
      .append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .classed('user-select-none', true)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', VARIANT_Constants.FONT_SIZE)
      .attr('fill', textcolor)
      .classed('activity-text', true);

    let y = height / 2;
    if (leafNode.activity.length > 1) {
      y =
        height / 2 -
        ((leafNode.activity.length - 1) / 2) *
          (VARIANT_Constants.FONT_SIZE + VARIANT_Constants.MARGIN_Y);
    }

    parent
      .append('path')
      .attr('fill', textcolor)
      .attr(
        'd',
        'M11 5.466V4H5a4 4 0 0 0-3.584 5.777.5.5 0 1 1-.896.446A5 5 0 0 1 5 3h6V1.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192Zm3.81.086a.5.5 0 0 1 .67.225A5 5 0 0 1 11 13H5v1.466a.25.25 0 0 1-.41.192l-2.36-1.966a.25.25 0 0 1 0-.384l2.36-1.966a.25.25 0 0 1 .41.192V12h6a4 4 0 0 0 3.585-5.777.5.5 0 0 1 .225-.67Z'
      )
      .attr(
        'transform',
        `translate(${width / 2 - 8}, ${VARIANT_Constants.MARGIN_Y})`
      );

    let label = leafNode.activity[0];
    const tspan = activityText
      .append('tspan')
      .attr('x', width / 2)
      .attr('y', y + VARIANT_Constants.FONT_SIZE - VARIANT_Constants.MARGIN_Y)
      .classed(
        'cursor-pointer',
        (!this.traceInfixSelectionMode || actionable) && this.addCursorPointer
      )
      .text(label);

    const maxWidth =
      loopGroup.getWidth() -
      loopGroup.getHeadLength() * 2 -
      VARIANT_Constants.MARGIN_X;
    const truncated = this.wrapInnerLabelText(tspan, label, maxWidth);

    if (truncated) {
      activityText
        .attr('title', leafNode.activity[0])
        .attr('data-bs-toggle', 'tooltip');
    }

    if (this.onMouseOverCbFc) {
      this.onMouseOverCbFc(this, loopGroup, this.variant, parent);
    }
  }

  drawSequenceGroup(
    element: SequenceGroup,
    parent: Selection<any, any, any, any>,
    outerElement: boolean
  ): void {
    const width = element.getWidth();
    const height = element.getHeight();

    const polygonPoints = this.polygonService.getPolygonPoints(width, height);

    const color = 'lightgrey';

    let laElement = getLowestSelectionActionableElement(element);
    let actionable =
      laElement.parent !== null &&
      laElement.infixSelectableState !== SelectableState.None;

    let polygon = this.createPolygon(
      parent,
      polygonPoints,
      color,
      actionable,
      true
    );

    if (
      this.traceInfixSelectionMode &&
      element.parent &&
      !(element instanceof InvisibleSequenceGroup)
    ) {
      this.addInfixSelectionAttributes(element, polygon, false);
    }

    if (
      element instanceof InvisibleSequenceGroup ||
      element.parent instanceof SkipGroup
    ) {
      polygon.style('fill', 'transparent');
    } else {
      if (this.onClickCbFc) {
        parent.on('click', (e: PointerEvent) => {
          this.onVariantClick(element);
          e.stopPropagation();
        });
      }
    }

    let xOffset = 0;

    const inEditor =
      d3
        .select(this.svgHtmlElement.nativeElement)
        .classed('in-variant-modeler') ||
      d3.select(this.svgHtmlElement.nativeElement).classed('pattern-variant');

    if (
      (!outerElement ||
        inEditor ||
        (!this.keepStandardView &&
          this.variantViewModeService.viewMode === ViewMode.PERFORMANCE)) &&
      !(element.parent instanceof SkipGroup)
    ) {
      xOffset +=
        element.getHeadLength() +
        element.getMarginX() -
        element.elements[0].getHeadLength();
    }

    for (const child of element.elements) {
      if (
        child instanceof WaitingTimeNode &&
        (this.keepStandardView ||
          this.variantViewModeService.viewMode !== ViewMode.PERFORMANCE)
      ) {
        continue;
      }

      const childWidth = child.getWidth(
        !this.keepStandardView &&
          this.variantViewModeService.viewMode === ViewMode.PERFORMANCE
      );
      const childHeight = child.getHeight();
      const yOffset = height / 2 - childHeight / 2;
      const g = parent
        .append('g')
        .attr('transform', `translate(${xOffset}, ${yOffset})`);

      this.draw(child, g, false);
      xOffset += childWidth;
    }

    if (this.onMouseOverCbFc) {
      this.onMouseOverCbFc(this, element, this.variant, parent);
    }

    if (this.onRightMouseClickCbFc) {
      parent.on('contextmenu', (e: PointerEvent) => {
        this.onRightMouseClickCbFc(this, element, this.variant, e);
        e.stopPropagation();
      });
    }
  }

  drawParallelGroup(
    element: ParallelGroup,
    parent: Selection<any, any, any, any>
  ): void {
    const width = element.getWidth();
    const height = element.getHeight();

    const polygonPoints = this.polygonService.getPolygonPoints(width, height);

    let laElement = getLowestSelectionActionableElement(element);
    let actionable =
      laElement.parent !== null &&
      laElement.infixSelectableState !== SelectableState.None;

    const color = 'lightgrey';
    let polygon = this.createPolygon(
      parent,
      polygonPoints,
      color,
      actionable,
      true
    );

    if (
      this.traceInfixSelectionMode &&
      !(element instanceof InvisibleSequenceGroup)
    ) {
      this.addInfixSelectionAttributes(element, polygon, false);
    }

    if (this.onClickCbFc) {
      parent.on('click', (e: PointerEvent) => {
        this.onVariantClick(element);
        e.stopPropagation();
      });
    }

    if (this.onRightMouseClickCbFc) {
      parent.on('contextmenu', (e: PointerEvent) => {
        this.onRightMouseClickCbFc(this, element, this.variant, e);
        e.stopPropagation();
      });
    }

    let y = VARIANT_Constants.MARGIN_Y;

    for (const child of element.elements) {
      if (
        child instanceof WaitingTimeNode &&
        (this.keepStandardView ||
          this.variantViewModeService.viewMode !== ViewMode.PERFORMANCE)
      ) {
        continue;
      }

      const height = child.getHeight();
      const x = element.getHeadLength() + 0.5 * VARIANT_Constants.MARGIN_X;
      const g = parent.append('g').attr('transform', `translate(${x}, ${y})`);
      this.draw(child, g, false);
      y += height + VARIANT_Constants.MARGIN_Y;
    }

    if (this.onMouseOverCbFc) {
      this.onMouseOverCbFc(this, element, this.variant, parent);
    }
  }

  drawChoiceGroup(
    element: ChoiceGroup,
    parent: Selection<any, any, any, any>
  ): void {
    const width = element.getWidth();
    const height = element.getHeight();

    const polygonPoints = this.polygonService.getPolygonPoints(width, height);

    let laElement = getLowestSelectionActionableElement(element);
    let actionable =
      laElement.parent !== null &&
      laElement.infixSelectableState !== SelectableState.None;

    const color = 'lightgrey';
    let polygon = this.createPolygon(
      parent,
      polygonPoints,
      color,
      actionable,
      true
    );

    if (
      this.traceInfixSelectionMode &&
      !(element instanceof InvisibleSequenceGroup)
    ) {
      this.addInfixSelectionAttributes(element, polygon, false);
    }

    if (this.onClickCbFc) {
      parent.on('click', (e: PointerEvent) => {
        this.onVariantClick(element);
        e.stopPropagation();
      });
    }

    if (this.onRightMouseClickCbFc) {
      parent.on('contextmenu', (e: PointerEvent) => {
        this.onRightMouseClickCbFc(this, element, this.variant, e);
        e.stopPropagation();
      });
    }

    let y = VARIANT_Constants.MARGIN_Y;

    //edited
    const textcolor = textColorForBackgroundColor(
      color,
      this.traceInfixSelectionMode && !element.selected
    );

    const v_height = element.getHeight();
    const v_width = element.getWidth();

    const activityText = parent
      .append('text')
      .attr('x', v_width / 2)
      .attr('y', v_height / 2)
      .classed('user-select-none', true)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr(
        'font-size',
        (VARIANT_Constants.LEAF_HEIGHT + VARIANT_Constants.MARGIN_Y) *
          element.elements.length +
          VARIANT_Constants.MARGIN_Y
      )
      .attr('font-weight', 300)
      .attr('fill', textcolor)
      .classed('activity-text', true);

    const tspan_infront = activityText
      .append('tspan')
      .attr(
        'x',
        element.getHeadLength() +
          0.5 *
            (((VARIANT_Constants.LEAF_HEIGHT + VARIANT_Constants.MARGIN_Y) *
              element.elements.length +
              VARIANT_Constants.MARGIN_Y) /
              2.8) +
          0.5 * VARIANT_Constants.MARGIN_X
      )
      .attr('y', v_height / 2)
      .classed(
        'cursor-pointer',
        (!this.traceInfixSelectionMode || actionable) && this.addCursorPointer
      )
      .text('{');

    for (const child of element.elements) {
      if (
        child instanceof WaitingTimeNode &&
        (this.keepStandardView ||
          this.variantViewModeService.viewMode !== ViewMode.PERFORMANCE)
      ) {
        continue;
      }

      const height = child.getHeight();
      const x =
        element.getHeadLength() +
        0.5 * VARIANT_Constants.MARGIN_X +
        ((VARIANT_Constants.LEAF_HEIGHT + VARIANT_Constants.MARGIN_Y) *
          element.elements.length +
          VARIANT_Constants.MARGIN_Y) /
          2.8;
      const g = parent.append('g').attr('transform', `translate(${x}, ${y})`);
      this.draw(child, g, false);
      y += height + VARIANT_Constants.MARGIN_Y;
    }

    const tspan_behind = activityText
      .append('tspan')
      .attr(
        'x',
        element.getWidth() -
          element.getHeadLength() -
          0.5 * VARIANT_Constants.MARGIN_X -
          0.5 *
            (((VARIANT_Constants.LEAF_HEIGHT + VARIANT_Constants.MARGIN_Y) *
              element.elements.length +
              VARIANT_Constants.MARGIN_Y) /
              2.8)
      )
      .attr('y', v_height / 2)
      .classed(
        'cursor-pointer',
        (!this.traceInfixSelectionMode || actionable) && this.addCursorPointer
      )
      .text('}');

    if (this.onMouseOverCbFc) {
      this.onMouseOverCbFc(this, element, this.variant, parent);
    }
  }

  drawFallthroughGroup(
    element: FallthroughGroup,
    parent: Selection<any, any, any, any>
  ): void {
    const width = element.getWidth();
    const height = element.getHeight();

    const polygonPoints = this.polygonService.getPolygonPoints(width, height);

    let laElement = getLowestSelectionActionableElement(element);
    let actionable =
      laElement.parent !== null &&
      laElement.infixSelectableState !== SelectableState.None;

    const color = 'lightgrey';
    let polygon = this.createFallthroughPolygon(
      parent,
      polygonPoints,
      color,
      actionable,
      true
    );

    if (
      this.traceInfixSelectionMode &&
      !(element instanceof InvisibleSequenceGroup)
    ) {
      this.addInfixSelectionAttributes(element, polygon, false);
    }

    if (this.onClickCbFc) {
      parent.on('click', (e: PointerEvent) => {
        this.onVariantClick(element);
        e.stopPropagation();
      });
    }

    if (this.onRightMouseClickCbFc) {
      parent.on('contextmenu', (e: PointerEvent) => {
        this.onRightMouseClickCbFc(this, element, this.variant, e);
        e.stopPropagation();
      });
    }

    let y = VARIANT_Constants.MARGIN_Y;

    for (const child of element.elements) {
      if (
        child instanceof WaitingTimeNode &&
        (this.keepStandardView ||
          this.variantViewModeService.viewMode !== ViewMode.PERFORMANCE)
      ) {
        continue;
      }

      const height = child.getHeight();
      const x = element.getHeadLength() + 0.5 * VARIANT_Constants.MARGIN_X;
      const g = parent.append('g').attr('transform', `translate(${x}, ${y})`);
      this.draw(child, g, false);
      y += height + VARIANT_Constants.MARGIN_Y;
    }

    if (this.onMouseOverCbFc) {
      this.onMouseOverCbFc(this, element, this.variant, parent);
    }
  }

  private createPolygon(
    parent: d3.Selection<any, any, any, any>,
    polygonPoints: string,
    color: string,
    actionable: boolean,
    group = false,
    dashed: boolean = false
  ) {
    const poly = parent
      .append('polygon')
      .attr('points', polygonPoints)
      .attr('fill', dashed ? 'url(#variantConformanceStriped)' : color)
      .classed(
        'cursor-pointer',
        (!this.traceInfixSelectionMode || actionable) && this.addCursorPointer
      );

    if (group) {
      poly.classed('chevron-group', true);
      poly.style('fill-opacity', 0.5).style('stroke-width', 2);
    }

    return poly;
  }

  private createFallthroughPolygon(
    parent: d3.Selection<any, any, any, any>,
    polygonPoints: string,
    color: string,
    actionable: boolean,
    group = false
  ) {
    const poly = parent
      .append('polygon')
      .attr('points', polygonPoints)
      .style('fill', color)
      .classed('cursor-pointer', !this.traceInfixSelectionMode || actionable);
    poly.classed('chevron-group', true);
    poly.style('stroke-width', 2);
    return poly;
  }

  public drawLeafNode(
    element: LeafNode,
    parent: Selection<any, any, any, any>
  ): void {
    const width = element.getWidth();
    let height = element.getHeight();
    const polygonPoints = this.polygonService.getPolygonPoints(width, height);

    const color = this.computeActivityColor(this, element, this.variant);

    let laElement = getLowestSelectionActionableElement(element);

    let actionable =
      laElement.parent !== null &&
      laElement.infixSelectableState !== SelectableState.None;

    let dashed = false;

    if (
      !element.isSyncAlignmentLeaf &&
      element.alignmentEid &&
      !this.keepStandardView &&
      this.variantViewModeService.viewMode === ViewMode.CONFORMANCE
    ) {
      dashed = true;
    }

    let polygon = this.createPolygon(
      parent,
      polygonPoints,
      color,
      actionable,
      false,
      dashed
    );

    if (this.traceInfixSelectionMode) {
      this.addInfixSelectionAttributes(element, polygon, true);
    }

    const textcolor = textColorForBackgroundColor(
      color,
      this.traceInfixSelectionMode && !element.selected
    );

    const activityText = parent
      .append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .classed('user-select-none', true)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', VARIANT_Constants.FONT_SIZE)
      .attr('fill', dashed ? 'black' : textcolor)
      .classed('activity-text', true);

    let y = height / 2;
    if (element.activity.length > 1) {
      y =
        height / 2 -
        ((element.activity.length - 1) / 2) *
          (VARIANT_Constants.FONT_SIZE + VARIANT_Constants.MARGIN_Y);
    }

    let truncated = false;
    let dy = 0;

    element.activity.forEach((a, _i) => {
      const tspan = activityText
        .append('tspan')
        .attr('x', width / 2)
        .attr('y', y + dy)
        .classed(
          'cursor-pointer',
          (!this.traceInfixSelectionMode || actionable) && this.addCursorPointer
        )
        .text(a);

      dy += VARIANT_Constants.FONT_SIZE + VARIANT_Constants.MARGIN_Y;
      tspan.attr(
        'height',
        VARIANT_Constants.FONT_SIZE + VARIANT_Constants.MARGIN_Y
      );

      const maxWidth =
        element.getWidth() -
        element.getHeadLength() * 2 -
        VARIANT_Constants.MARGIN_X;
      const tr = this.wrapInnerLabelText(tspan, a, maxWidth);
      truncated ||= tr;

      if (a === 'W_Nabellen incomplete dossiers' && !tr) {
        console.log('Did not wrap', a, tspan, maxWidth);
      }
    });

    if (truncated) {
      activityText
        .attr('title', element.activity.join(';'))
        .attr('data-bs-toggle', 'tooltip');
      // manually trigger tooltip through jquery
      activityText.on('mouseenter', (e: PointerEvent, data) => {
        // @ts-ignore
        this.variantService.activityTooltipReference = $(e.target);
        this.variantService.activityTooltipReference.tooltip('show');
      });
    }

    if (this.onClickCbFc) {
      parent.on('click', (e: PointerEvent) => {
        this.onVariantClick(element);
        // hide the tooltip
        if (this.variantService.activityTooltipReference) {
          this.variantService.activityTooltipReference.tooltip('hide');
        }
        e.stopPropagation();
      });
    }

    if (this.onMouseOverCbFc) {
      this.onMouseOverCbFc(this, element, this.variant, parent);
    }

    parent.on('mouseover', (e: PointerEvent) => {
      this.onMouseOverAlignment((e.currentTarget as any).__data__.alignmentEid);
    });
    parent.on('mouseout', (e: PointerEvent) => {
      this.onMouseOutAlignment();
    });
  }

  onMouseOverAlignment(eid: number) {
    this.highlightSynchronousChevrons(
      this.variantVisualisationComponent.variantDrawer.svgHtmlElement,
      0.4,
      eid
    );
    this.highlightSynchronousChevrons(this.svgHtmlElement, 0.4, eid);
  }

  onMouseOutAlignment() {
    this.highlightSynchronousChevrons(
      this.variantVisualisationComponent.variantDrawer.svgHtmlElement,
      1
    );
    this.highlightSynchronousChevrons(this.svgHtmlElement, 1);
  }

  highlightSynchronousChevrons(
    elementRef: ElementRef<any>,
    transparency: number,
    eid?: number
  ) {
    let elements = d3
      .select(elementRef.nativeElement)
      .selectAll('g.variant-element-group');
    // blur out all the chevrons
    elements.style('fill-opacity', transparency)
      .select('polygon')
      .style('stroke', 'none');

    if (transparency !== 1) {
      elements
        .filter(function (d: any) {
          return d.alignmentEid == eid;
        })
        .style('fill-opacity', 1)
        .select('polygon')
        .style('stroke-width', '1')
        .style('stroke', 'red');
    }
  }

  onVariantClick(element: VariantElement) {
    this.onClickCbFc(this, element, this.variant);
    this.redrawArcsIfComputed.emit();
  }

  private addInfixSelectionAttributes(
    element: VariantElement,
    polygon: any,
    isLeafNode: boolean
  ) {
    if (
      !this.keepStandardView &&
      this.variantViewModeService.viewMode === ViewMode.PERFORMANCE
    )
      return;

    if (element.selected) {
      polygon.attr('stroke-opacity', '0.5');
      if (!element.isVisibleParentSelected())
        polygon.attr('stroke', '#ff0000').attr('stroke-width', '4px');
      return;
    }

    if (element.infixSelectableState !== SelectableState.Selectable) {
      polygon.style('fill-opacity', '0.1');
      return;
    }

    // element is selectable
    polygon
      .attr('stroke', '#ff0000')
      .attr('stroke-width', '1px')
      .attr('stroke-dasharray', 4);

    if (isLeafNode) {
      polygon.style('fill-opacity', '0.2');
    } else {
      polygon.style('fill', '#999999');
    }
  }

  private drawWaitingNode(
    element: LeafNode,
    parent: Selection<any, any, any, any>
  ) {
    const width = element.getWidth();
    const height = element.getHeight();

    const polygonPoints = this.polygonService.getPolygonPoints(width, height);

    const color = this.computeActivityColor(this, element, this.variant);

    this.createPolygon(parent, polygonPoints, color, false);

    if (this.onClickCbFc) {
      parent.on('click', (e: PointerEvent) => {
        this.onVariantClick(element);
        e.stopPropagation();
      });
    }

    if (this.onRightMouseClickCbFc) {
      parent.on('contextmenu', (e: PointerEvent) => {
        this.onRightMouseClickCbFc(this, element, this.variant, e);
        e.stopPropagation();
      });
    }

    if (this.onMouseOverCbFc) {
      this.onMouseOverCbFc(this, element, this.variant, parent);
    }
  }

  drawSkipGroup(
    element: SequenceGroup,
    parent: Selection<any, any, any, any>
  ): void {
    const height = element.getHeight();

    let xOffset = 0;

    element.elements.forEach((child, idx) => {
      const childWidth = child.getWidth(
        !this.keepStandardView &&
          this.variantViewModeService.viewMode === ViewMode.PERFORMANCE
      );
      const childHeight = child.getHeight();
      const yOffset = height / 2 - childHeight / 2;
      const g = parent
        .append('g')
        .attr('transform', `translate(${xOffset}, ${yOffset})`);

      this.draw(child, g, false);
      xOffset += childWidth;

      if (idx >= element.elements.length - 1) return;

      const heightOffset =
        (element.getHeight() - 2 * VARIANT_Constants.MARGIN_Y) / 2 - 7.65;
      xOffset += VARIANT_Constants.SKIP_MARGIN;
      parent
        .append('g')
        .attr('transform', `translate(${xOffset}, ${heightOffset})`)
        .append('use')
        .attr('href', '#infixDots')
        .attr('transform', 'scale(1.7)');
      xOffset += VARIANT_Constants.SKIP_WIDTH + VARIANT_Constants.SKIP_MARGIN;
    });

    if (this.onMouseOverCbFc) {
      this.onMouseOverCbFc(this, element, this.variant, parent);
    }
  }

  private wrapInnerLabelText(
    textSelection: Selection<any, any, any, any>,
    text: string,
    maxWidth: number
  ): boolean {
    let textLength = this.getComputedTextLength(textSelection);
    //let textLength = textSelection.node().getBoundingClientRect().width;

    let truncated = false;
    while (textLength > maxWidth && text.length > 1) {
      text = text.slice(0, -1);
      if (text[text.length - 1] == ' ') {
        text = text.slice(0, -1);
      }
      textSelection.text(text + '..');
      textLength = this.getComputedTextLength(textSelection);
      //textLength = textSelection.node().getBoundingClientRect().width;
      truncated = true;
    }

    if (text === 'W_Nabellen incomplete dossiers' && !truncated) {
      console.log('Inner Text length after Wrap', text, textLength, maxWidth);
    }

    return truncated;
  }

  private getComputedTextLength(
    textSelection: Selection<any, any, any, any>
  ): number {
    let textLength;
    if (
      this.sharedDataService.computedTextLengthCache.has(textSelection.text())
    ) {
      textLength = this.sharedDataService.computedTextLengthCache.get(
        textSelection.text()
      );
    } else {
      textLength = textSelection.node().getBoundingClientRect().width;
      if (textLength == 0) {
        textLength =
          textSelection.text().length * VARIANT_Constants.CHAR_LENGTH;
      }
    }
    if (textLength > 0) {
      this.sharedDataService.computedTextLengthCache.set(
        textSelection.text(),
        textLength
      );
    }

    return textLength;
  }

  setInspectVariant() {
    d3.select('.selected-polygon').classed('selected-polygon', false);
    d3.selectAll('.variant-polygon').classed(
      'cursor-pointer',
      !this.keepStandardView &&
        this.variantViewModeService.viewMode === ViewMode.PERFORMANCE &&
        this.addCursorPointer
    );
    d3.selectAll('.activity-text').classed(
      'cursor-pointer',
      !this.keepStandardView &&
        this.variantViewModeService.viewMode === ViewMode.PERFORMANCE &&
        this.addCursorPointer
    );
  }

}
