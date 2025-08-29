import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button'; 
import { HrDashboardComponent } from './hr-dashboard/hr-dashboard.component';
import { HrSideNavbarComponent } from './hr-side-navbar/hr-side-navbar.component';
import { AssetManagementComponent  } from './asset-management-hr/asset-management-hr.component';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    HrDashboardComponent,
    HrSideNavbarComponent,
    AssetManagementComponent ,

  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatButtonModule,
    ReactiveFormsModule ,

  ],
  exports: [
    HrDashboardComponent,
    HrSideNavbarComponent,
    AssetManagementComponent
  ],
})
export class HrModule {}
