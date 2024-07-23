import { Component, HostListener, Input, OnInit } from '@angular/core';
import { Variant } from 'src/app/objects/Variants/variant';
import { ConformanceCheckingService } from '../../../../../../services/conformanceChecking/conformance-checking.service';

@Component({
  selector: 'app-conformance-status-icon',
  templateUrl: './conformance-status-icon.component.html',
  styleUrls: ['./conformance-status-icon.component.css'],
})
export class ConformanceStatusIconComponent {
  @Input()
  variant: Variant;
  constructor(public conformanceCheckingService: ConformanceCheckingService) {}

  @HostListener('click') onClick() {
    console.log('User Click using Host Listener');
    this.conformanceCheckingService.selectedVariantForInsights = this.variant;
  }
}
