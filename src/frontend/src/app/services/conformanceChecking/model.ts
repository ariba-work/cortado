import { ProcessTree } from 'src/app/objects/ProcessTree/ProcessTree';
import { Dependency } from '../../objects/Variants/dependency';

export class ConformanceCheckingResult {
  constructor(
    public id: string,
    public type: number,
    public isTimeout: boolean,
    public cost: number,
    public deviations: number,
    public alignment: string,
    public processTree: ProcessTree,
    public variant: string,
    public deviationDependencies: Dependency[]
  ) {
    this.deviationDependencies = deviationDependencies.map(Dependency.fromJSON);
  }
}
export interface treeConformanceResult {
  merged_conformance_tree: ProcessTree;
  variants_tree_conformance: ProcessTree[];
}
