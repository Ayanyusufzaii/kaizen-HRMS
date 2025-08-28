import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-emp-side-navbar',
  templateUrl: './emp-side-navbar.component.html',
  styleUrls: ['./emp-side-navbar.component.css']
})
export class EmpSideNavbarComponent {


    isSidebarMinimized = false;
  
    users: any = {
      name: 'Employee',   // fallback value if user is not found
      email: '',          // ensure email field is included
      employeeId: ''      // ensure employeeId field is included
    };
  
    constructor(private authService: AuthService, private router: Router) {}
  
    ngOnInit(): void {
      const user = this.authService.getUser();
      if (user) {
        this.users = user;  // assign user data
        console.log('User email:', user.email);
        console.log('User employee ID:', user.id); // Assuming `id` is the employee ID
      } else {
        console.error('No user found');
        this.router.navigate(['/login']);  // Redirect to login if user is not found
      }
    }
  
    toggleSidebar(): void {
      this.isSidebarMinimized = !this.isSidebarMinimized;
    }
  
    logout(): void {
      this.authService.clearUser();  // Clear user data from AuthService and localStorage
      this.router.navigate(['/login']);
    }
  

}
