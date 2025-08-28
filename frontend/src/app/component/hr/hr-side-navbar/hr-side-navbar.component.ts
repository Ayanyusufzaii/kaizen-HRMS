import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
@Component({
  selector: 'app-hr-side-navbar',
  templateUrl: './hr-side-navbar.component.html',
  styleUrls: ['./hr-side-navbar.component.css']
})
export class HrSideNavbarComponent {


  constructor(private router: Router) {}

  logout() {
    // Example logout logic — clear token or session
    localStorage.clear();
    this.router.navigate(['/login']);
  }
  // Add this property so the dashboard component can access it
  @Input() isMinimized: boolean = false;
}

