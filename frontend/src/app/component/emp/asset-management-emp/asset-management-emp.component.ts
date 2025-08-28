import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-asset-management-emp',
  templateUrl: './asset-management-emp.component.html',
  styleUrls: ['./asset-management-emp.component.css'],
  providers: [DatePipe]
})
export class AssetManagementEmpComponent implements OnInit {
  activeTab = 'my-assets';
  isSidebarMinimized = false;
  isRaiseTicketModalOpen = false;
  selectedFile: File | null = null;
  
  user = { name: 'Employee', email: '' };
  
  // Sample data - replace with API calls
  myAssets = [
    { id: 1, deviceName: 'Dell Laptop', category: 'Laptop', serialNo: 'DL12345', assignedDate: new Date('2023-01-15'), condition: 'Good', status: 'Active' },
    { id: 2, deviceName: 'Logitech Mouse', category: 'Peripheral', serialNo: 'LM67890', assignedDate: new Date('2023-02-20'), condition: 'Excellent', status: 'Active' }
  ];
  
  raisedIssues = [
    { ticketId: 'TKT001', deviceName: 'Dell Laptop', issueDate: new Date('2023-05-10'), description: 'Keyboard not working properly', status: 'Under Review' },
    { ticketId: 'TKT002', deviceName: 'Logitech Mouse', issueDate: new Date('2023-06-15'), description: 'Scroll wheel malfunctioning', status: 'In Progress' }
  ];
  
  hrResponses = [
    { ticketId: 'TKT002', deviceName: 'Logitech Mouse', responseDate: new Date('2023-06-18'), hrMessage: 'We have ordered a replacement mouse. It will arrive in 3-5 business days.', status: 'In Progress' }
  ];
  
  ticketRequest = {
    deviceId: '',
    description: '',
    proof: null
  };

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.user = user;
    // In a real application, you would fetch data from APIs here
    // this.fetchMyAssets();
    // this.fetchRaisedIssues();
    // this.fetchHrResponses();
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  openRaiseTicketModal(): void {
    this.isRaiseTicketModalOpen = true;
  }

  closeRaiseTicketModal(): void {
    this.isRaiseTicketModalOpen = false;
    this.resetTicketForm();
  }

  resetTicketForm(): void {
    this.ticketRequest = {
      deviceId: '',
      description: '',
      proof: null
    };
    this.selectedFile = null;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  submitTicket(): void {
    if (!this.ticketRequest.deviceId || !this.ticketRequest.description) {
      alert('Please fill in all required fields.');
      return;
    }

    if (this.selectedFile && this.selectedFile.size > 5242880) {
      alert('File size exceeds 5MB limit. Please choose a smaller file.');
      return;
    }

    // Create form data for file upload
    const formData = new FormData();
    formData.append('deviceId', this.ticketRequest.deviceId);
    formData.append('description', this.ticketRequest.description);
    formData.append('employeeEmail', this.user.email);
    
    if (this.selectedFile) {
      formData.append('proof', this.selectedFile);
    }

    // In a real application, you would send this to your backend
    // this.http.post('http://localhost:3000/api/raise-ticket', formData).subscribe({
    //   next: (response) => {
    //     alert('Ticket raised successfully!');
    //     this.closeRaiseTicketModal();
    //     this.fetchRaisedIssues();
    //   },
    //   error: (err) => {
    //     console.error('Error raising ticket:', err);
    //     alert('Failed to raise ticket. Please try again.');
    //   }
    // });

    // For demo purposes, we'll just show an alert
    alert('Ticket raised successfully! (This is a demo. In a real app, this would be sent to the server)');
    this.closeRaiseTicketModal();
  }

  cancelTicket(ticketId: string): void {
    if (confirm('Are you sure you want to cancel this ticket?')) {
      // In a real application, you would call an API to cancel the ticket
      // this.http.delete(`http://localhost:3000/api/tickets/${ticketId}`).subscribe({
      //   next: () => {
      //     this.fetchRaisedIssues();
      //   },
      //   error: (err) => {
      //     console.error('Error canceling ticket:', err);
      //     alert('Failed to cancel ticket. Please try again.');
      //   }
      // });
      
      // For demo purposes, we'll just show an alert
      alert(`Ticket ${ticketId} canceled successfully! (This is a demo. In a real app, this would be sent to the server)`);
    }
  }

  logout(): void {
    this.authService.clearUser();
    this.router.navigate(['/login']);
  }
}