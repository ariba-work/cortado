import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnInit,
} from '@angular/core';
import { ColorMapService } from '../../../../services/colorMapService/color-map.service';
import { ConformanceCheckingService } from '../../../../services/conformanceChecking/conformance-checking.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DependencyDeviationCounter } from '../../../../objects/Variants/dependency-deviation-counter';
import { Variant } from '../../../../objects/Variants/variant';
import { computeActivityColor } from '../../../../utils/render-utils';
import { LogService } from '../../../../services/logService/log.service';
import { LeafNode } from '../../../../objects/Variants/variant_element';
import { Dependency } from '../../../../objects/Variants/dependency';
import _ from 'lodash';
import { ProcessTreeOperator } from 'src/app/objects/ProcessTree/ProcessTree';

@Component({
  selector: 'app-violations',
  templateUrl: './violations.component.html',
  styleUrls: ['./violations.component.css'],
})
export class ViolationsComponent implements OnInit, AfterViewInit {
  constructor(
    elRef: ElementRef,
    private colorMapService: ColorMapService,
    private conformanceCheckingService: ConformanceCheckingService,
    private logService: LogService
  ) {}

  private _destroy$ = new Subject();
  public dependenciesDeviations: DependencyDeviationCounter;
  public selectedVariantForInsights: Variant;
  public undesiredDeps: Dependency[];
  public missingDeps: Dependency[];
  public colorMap: Map<string, string>;
  computeActivityColor = computeActivityColor.bind(this);
  @Input()
  activityNames: Array<string> = [];
  activityDummyVariants: Map<string, LeafNode> = new Map();

  ngOnInit(): void {
    this.conformanceCheckingService.connect();
    this.colorMapService.colorMap$
      .pipe(takeUntil(this._destroy$))
      .subscribe((cMap) => {
        this.colorMap = cMap;
      });
    this.activityDummyVariants.set(
      ProcessTreeOperator.tau,
      new LeafNode([ProcessTreeOperator.tau])
    );
  }

  ngAfterViewInit(): void {
    this.conformanceCheckingService.depsDeviationCounter$
      .pipe(takeUntil(this._destroy$))
      .subscribe((res: DependencyDeviationCounter) => {
        this.dependenciesDeviations = res;
      });
    this.colorMapService.colorMap$
      .pipe(takeUntil(this._destroy$))
      .subscribe((colorMap) => {
        this.colorMap = colorMap;
      });

    this.logService.activitiesInEventLog$
      .pipe(takeUntil(this._destroy$))
      .subscribe((activities) => {
        Object.entries(activities).forEach(([activity], idx: number) => {
          this.setActivityDummyVariants(activity);
        });
      });
    this.conformanceCheckingService.selectedVariantForInsights$
      .pipe(takeUntil(this._destroy$))
      .subscribe((v: Variant) => {
        if (v && v.alignment) {
          this.selectedVariantForInsights = v;
          [this.undesiredDeps, this.missingDeps] = _.partition(
            _.filter(
              this.selectedVariantForInsights.dependencyDeviations,
              (dep) => dep.connects_sync_moves
            ),
            function (dep) {
              return dep.is_followed;
            }
          );
        }
      });
  }

  setActivityDummyVariants(activity: string) {
    const leaf = new LeafNode([activity]);
    leaf.setExpanded(true);
    this.activityDummyVariants.set(activity, leaf);
  }
}
