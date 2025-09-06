import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';

interface Asset {
  asset_id: string;
  name: string;
  type: string;
  brand: string;
  model: string;
  status: string;
  serial_no: string;
  created_at: Date;
}

interface MaintenanceTicket {
  ticket_id: string;
  asset_id: string;
  model: string;
  description: string;
  status: string;
  created_at: Date;
}

interface HRResponse {
  ticket_id: string;
  asset_id: string;
  model: string;
  description: string;
  status: string;
  hr_response: string;
  hr_response_date: Date;
  created_at: Date;
}

interface ActivityLog {
  date: Date;
  user: string;
  message: string;
  type: string;
  attachments?: string[];
}

@Component({
  selector: 'app-asset-management-emp',
  templateUrl: './asset-management-emp.component.html',
  styleUrls: ['./asset-management-emp.component.css'],
  providers: [DatePipe]
})
export class AssetManagementEmpComponent implements OnInit {
  // UI State
  activeTab = 'my-assets';
  isSidebarMinimized = false;
  isRaiseTicketModalOpen = false;
  isActivityLogModalOpen = false;
  isLoading = false;
  isSubmitting = false;
  
  // File handling
  selectedFile: File | null = null;
  fileError: string = '';
  
  // User data
  user = { name: 'Employee', email: '' };
  
  // Data arrays
  myAssets: Asset[] = [];
  raisedIssues: MaintenanceTicket[] = [];
  hrResponses: HRResponse[] = [];
  
  // Modal data
  selectedTicket: any = null;
  selectedTicketActivities: ActivityLog[] = [];
  
  // Form data
  ticketRequest = {
    deviceId: '',
    description: '',
    proof: null
  };

  // API Base URL - Update this to match your backend
  private apiUrl = 'http://localhost:3000/api';

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
    this.loadInitialData();
  }

  // Load all initial data
  loadInitialData(): void {
    this.isLoading = true;
    Promise.all([
      this.fetchMyAssets(),
      this.fetchRaisedIssues(),
      this.fetchHrResponses()
    ]).finally(() => {
      this.isLoading = false;
    });
  }

  // Fetch assets assigned to logged-in user
 fetchMyAssets(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.http.get<any>(`${this.apiUrl}/assets?emp_email=${this.user.email}`)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.myAssets = response.data;
            console.log('My assets loaded:', this.myAssets);
          } else {
            console.error('Failed to fetch assets:', response.message);
          }
          resolve();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error fetching my assets:', err);
          this.showErrorMessage('Failed to load your assets. Please try again.');
          reject(err);
        }
      });
  });
}


  // Fetch tickets raised by logged-in user
  fetchRaisedIssues(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<any>(`${this.apiUrl}/maintenance_tickets?reported_by=${this.user.email}`)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.raisedIssues = response.data;
              console.log('Raised issues loaded:', this.raisedIssues);
            } else {
              console.error('Failed to fetch tickets:', response.message);
            }
            resolve();
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error fetching raised issues:', err);
            this.showErrorMessage('Failed to load your tickets. Please try again.');
            reject(err);
          }
        });
    });
  }

  // Fetch HR responses for logged-in user
  fetchHrResponses(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<any>(`${this.apiUrl}/hr-responses?email=${this.user.email}`)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.hrResponses = response.data;
              console.log('HR responses loaded:', this.hrResponses);
            } else {
              console.error('Failed to fetch HR responses:', response.message);
            }
            resolve();
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error fetching HR responses:', err);
            this.showErrorMessage('Failed to load HR responses. Please try again.');
            reject(err);
          }
        });
    });
  }

  // Tab navigation
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // Modal management
  openRaiseTicketModal(): void {
    if (this.myAssets.length === 0) {
      this.showErrorMessage('No assets assigned to you. Cannot raise a ticket.');
      return;
    }
    this.isRaiseTicketModalOpen = true;
  }

  closeRaiseTicketModal(): void {
    this.isRaiseTicketModalOpen = false;
    this.resetTicketForm();
  }

  openActivityLogModal(ticket: any): void {
    this.selectedTicket = ticket;
    this.selectedTicketActivities = [];
    this.isActivityLogModalOpen = true;
    this.fetchTicketActivityLogs(ticket.ticket_id);
  }

  closeActivityLogModal(): void {
    this.isActivityLogModalOpen = false;
    this.selectedTicket = null;
    this.selectedTicketActivities = [];
  }

  // Fetch activity logs for a specific ticket
  fetchTicketActivityLogs(ticketId: string): void {
    this.http.get<any>(`${this.apiUrl}/ticket-logs/${ticketId}`)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.selectedTicketActivities = response.data;
          } else {
            console.error('Failed to fetch ticket logs:', response.message);
            this.selectedTicketActivities = [];
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error fetching ticket logs:', err);
          this.selectedTicketActivities = [];
        }
      });
  }

  // Reset ticket form
  resetTicketForm(): void {
    this.ticketRequest = {
      deviceId: '',
      description: '',
      proof: null
    };
    this.selectedFile = null;
    this.fileError = '';
  }

  // File selection handler
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    this.fileError = '';
    
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5242880) {
        this.fileError = 'File size exceeds 5MB limit. Please choose a smaller file.';
        event.target.value = '';
        this.selectedFile = null;
        return;
      }

      // Check file type
      const allowedTypes = ['image/', 'video/'];
      const isValidType = allowedTypes.some(type => file.type.startsWith(type));
      
      if (!isValidType) {
        this.fileError = 'Invalid file type. Only images and videos are allowed.';
        event.target.value = '';
        this.selectedFile = null;
        return;
      }

      this.selectedFile = file;
      console.log('File selected:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    }
  }

  // Submit ticket
  // Fixed submitTicket method in asset-management-emp.component.ts
submitTicket(): void {
  if (!this.ticketRequest.deviceId || !this.ticketRequest.description) {
    this.showErrorMessage('Please fill in all required fields.');
    return;
  }

  if (this.fileError) {
    this.showErrorMessage('Please fix the file upload error before submitting.');
    return;
  }

  this.isSubmitting = true;

  // Create form data for file upload with correct field names
  const formData = new FormData();
  formData.append('asset_id', this.ticketRequest.deviceId);        // Changed from 'assetId'
  formData.append('issue_description', this.ticketRequest.description); // Changed from 'description'  
  formData.append('reported_by', this.user.email);                 // Changed from 'employeeEmail'
  formData.append('priority', 'Medium');                           // Added missing priority field
  
  if (this.selectedFile) {
    formData.append('files', this.selectedFile);                   // Changed from 'evidence' to 'files'
  }

  this.http.post<any>(`${this.apiUrl}/raise-ticket`, formData).subscribe({
    next: (response) => {
      this.isSubmitting = false;
      if (response.success) {
        this.showSuccessMessage('Ticket raised successfully!');
        this.closeRaiseTicketModal();
        this.fetchRaisedIssues(); // Refresh the tickets list
      } else {
        this.showErrorMessage('Failed to raise ticket: ' + response.message);
      }
    },
    error: (err: HttpErrorResponse) => {
      this.isSubmitting = false;
      console.error('Error raising ticket:', err);
      let errorMessage = 'Failed to raise ticket. Please try again.';
      
      if (err.error && err.error.message) {
        errorMessage = err.error.message;
      } else if (err.status === 413) {
        errorMessage = 'File too large. Please choose a smaller file.';
      }
      
      this.showErrorMessage(errorMessage);
    }
  });
}
  // Cancel ticket
  cancelTicket(ticketId: string): void {
    if (!confirm('Are you sure you want to cancel this ticket?')) {
      return;
    }

    this.http.delete<any>(`${this.apiUrl}/tickets/${ticketId}`)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.showSuccessMessage('Ticket cancelled successfully!');
            this.fetchRaisedIssues(); // Refresh the tickets list
          } else {
            this.showErrorMessage('Failed to cancel ticket: ' + response.message);
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error cancelling ticket:', err);
          let errorMessage = 'Failed to cancel ticket. Please try again.';
          
          if (err.error && err.error.message) {
            errorMessage = err.error.message;
          }
          
          this.showErrorMessage(errorMessage);
        }
      });
  }

  // Utility methods for user feedback
  private showSuccessMessage(message: string): void {
    // You can replace this with a proper toast/notification service
    alert('✅ ' + message);
  }

  private showErrorMessage(message: string): void {
    // You can replace this with a proper toast/notification service
    alert('❌ ' + message);
  }

  // Format file size for display
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get status color class
  getStatusColorClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'allocated':
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'open':
      case 'in progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'available':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
      case 'maintenance':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  // Logout
  logout(): void {
    this.authService.clearUser();
    this.router.navigate(['/login']);
  }

  // Refresh data manually
  refreshData(): void {
    this.loadInitialData();
  }

  // Track by functions for ngFor performance
  trackByAssetId(index: number, asset: Asset): string {
    return asset.asset_id;
  }

  trackByTicketId(index: number, ticket: MaintenanceTicket): string {
    return ticket.ticket_id;
  }

  trackByResponseId(index: number, response: HRResponse): string {
    return response.ticket_id;
  }
}