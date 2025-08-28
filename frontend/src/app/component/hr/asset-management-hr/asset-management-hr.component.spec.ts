import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssetManagementHrComponent } from './asset-management-hr.component';

describe('AssetManagementHrComponent', () => {
  let component: AssetManagementHrComponent;
  let fixture: ComponentFixture<AssetManagementHrComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AssetManagementHrComponent]
    });
    fixture = TestBed.createComponent(AssetManagementHrComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
