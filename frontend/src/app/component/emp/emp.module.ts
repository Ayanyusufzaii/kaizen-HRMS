import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmpDashboardComponent } from './emp-dashboard/emp-dashboard.component';
import { EmpSideNavbarComponent } from './emp-side-navbar/emp-side-navbar.component';
import { AssetManagementEmpComponent } from './asset-management-emp/asset-management-emp.component';

@NgModule({
  declarations: [
    EmpDashboardComponent,
    EmpSideNavbarComponent,
    AssetManagementEmpComponent
  ],
  imports: [CommonModule],
  exports: [EmpDashboardComponent]
})
export class EmployeeModule {}
