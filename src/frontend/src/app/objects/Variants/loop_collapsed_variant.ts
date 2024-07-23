import { ProcessTree } from '../ProcessTree/ProcessTree';
import { Variant } from './variant';
import { VariantElement } from './variant_element';
import { IVariant } from './variant_interface';
import { Dependency } from './dependency';

export class LoopCollapsedVariant implements IVariant {
  id: string;
  variants: Variant[];
  variant: VariantElement;
  isDisplayed: boolean;
  alignment: VariantElement;
  usedTreeForConformanceChecking: ProcessTree;
  fragmentStatistics: any;
  collapsedVariantId: string;
  clusterId: number;
  dependencyDeviations: Dependency[];

  constructor(
    id: string,
    variants: Variant[],
    collapsedVariantElement: VariantElement
  ) {
    this.id = id;
    this.variants = variants;
    this.variant = collapsedVariantElement;
  }

  /*
   * Empty implementation for now
   * @param variant
   */
  public equals(variant: Variant): boolean {
    return true;
  }

  get infixType() {
    return this.variants[0].infixType;
  }

  get bid() {
    return -10000;
  }

  get length() {
    return Math.min(...this.variants.map((v) => v.length));
  }

  get number_of_activities() {
    return this.variants[0].number_of_activities;
  }

  get count() {
    return this.variants.reduce((sum, v) => sum + v.count, 0);
  }

  get isSelected() {
    return this.variants.some((v) => v.isSelected);
  }

  set isSelected(isSelected: boolean) {
    this.variants.forEach((v) => (v.isSelected = isSelected));
  }

  get percentage() {
    return Number(
      this.variants.reduce((sum, v) => sum + v.percentage, 0).toFixed(2)
    );
  }

  get userDefined() {
    return this.variants.every((v) => v.userDefined);
  }

  get nSubVariants() {
    return this.variants.reduce((sum, v) => v.nSubVariants + sum, 0);
  }

  get isTimeouted() {
    return this.variants.some((v) => v.isTimeouted);
  }

  set isTimeouted(value) {
    this.variants.forEach((v) => (v.isTimeouted = value));
  }

  get isConformanceOutdated() {
    return this.variants.some((v) => v.isConformanceOutdated);
  }

  set isConformanceOutdated(value) {
    this.variants.forEach((v) => (v.isConformanceOutdated = value));
  }

  get isAddedFittingVariant() {
    return this.variants.every((v) => v.isAddedFittingVariant);
  }

  set isAddedFittingVariant(value) {
    this.variants.forEach((v) => (v.isAddedFittingVariant = value));
  }

  get calculationInProgress() {
    return this.variants.some((v) => v.calculationInProgress);
  }

  set calculationInProgress(value) {
    this.variants.forEach((v) => (v.calculationInProgress = value));
  }

  get deviations() {
    if (this.variants.some((v) => v.deviations === undefined)) {
      return undefined;
    }

    return Math.max(...this.variants.map((v) => v.deviations));
  }

  set deviations(value) {
    this.variants.forEach((v) => (v.deviations = value));
  }
}
