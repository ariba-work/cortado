import { Dependency } from './dependency';

export class DependencyDeviationCounter {
  counter: Map<Dependency, number>;

  constructor() {
    this.counter = new Map();
  }

  public increment(dependency: Dependency): void {
    const currentCount = this.counter.get(dependency) || 0;
    this.counter.set(dependency, currentCount + 1);
  }

  public getCount(dependency: Dependency): number {
    return this.counter.get(dependency) || 0;
  }
}
