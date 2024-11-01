import { Component, Input } from '@angular/core';
import { LogStats } from 'src/app/services/logService/log.service';

@Component({
  selector: 'app-conformance-info-bar',
  templateUrl: './conformance-info-bar.component.html',
})
export class ConformanceInfoBarComponent {
  @Input()
  logStats: LogStats;
  @Input()
  isConformanceOutdated: boolean;
  @Input()
  numSelectedVariants: number;

  constructor() {}
}
