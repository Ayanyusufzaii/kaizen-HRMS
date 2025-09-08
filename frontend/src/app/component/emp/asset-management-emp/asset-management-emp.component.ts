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
  issue_description: string;
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
  id: number;
  employee_id?: string;
  employee_email?: string;
  employee_name?: string;
  action_type: string;
  action_description: string;
  asset_id?: string;
  ticket_id?: string;
  performed_by: string;
  performed_by_name?: string;
  created_at: Date;
  additional_data?: any;
}

interface ActivityLogOld {
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
  
  // Modal data (legacy for ticket activity)
  selectedTicket: any = null;
  selectedTicketActivities: ActivityLogOld[] = [];
  
  // Form data
  ticketRequest = {
    deviceId: '',
    description: '',
    proof: null
  };

  // Employee Activity Logs Properties (New)
  employeeActivityLogs: ActivityLog[] = [];
  isLoadingEmployeeActivityLogs = false;
  expandedEmployeeActivityIds = new Set<number>();

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

  // ==================== EMPLOYEE ACTIVITY LOGS METHODS ====================

  /**
   * Load activity logs for the logged-in employee
   */
  loadEmployeeActivityLogs(): void {
    this.isLoadingEmployeeActivityLogs = true;
    
    this.http.get<{ success: boolean; data: ActivityLog[] }>
      (`${this.apiUrl}/employee/activity-logs?employee_email=${this.user.email}`)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.employeeActivityLogs = response.data;
            console.log('Employee activity logs loaded:', this.employeeActivityLogs);
          } else {
            console.error('Failed to load employee activity logs');
            this.employeeActivityLogs = [];
          }
          this.isLoadingEmployeeActivityLogs = false;
        },
        error: (error: HttpErrorResponse) => {
          console.error('Error loading employee activity logs:', error);
          this.employeeActivityLogs = [];
          this.isLoadingEmployeeActivityLogs = false;
          this.showErrorMessage('Failed to load activity logs. Please try again.');
        }
      });
  }

  /**
   * Toggle additional data visibility for an employee activity
   */
  toggleEmployeeAdditionalData(activityId: number): void {
    if (this.expandedEmployeeActivityIds.has(activityId)) {
      this.expandedEmployeeActivityIds.delete(activityId);
    } else {
      this.expandedEmployeeActivityIds.add(activityId);
    }
  }

  /**
   * Format additional data for display
   */
  formatAdditionalData(additionalData: any): string {
    if (!additionalData) return '';
    
    try {
      if (typeof additionalData === 'string') {
        additionalData = JSON.parse(additionalData);
      }
      return JSON.stringify(additionalData, null, 2);
    } catch (e) {
      return additionalData.toString();
    }
  }

  /**
   * Get action type display name
   */
  getActionTypeDisplayName(actionType: string): string {
    const actionTypeMap: { [key: string]: string } = {
      'asset_allocated': 'Asset Allocated to You',
      'ticket_raised': 'You Raised a Ticket',
      'ticket_responded': 'HR Responded to Your Ticket',
      'asset_returned': 'You Returned an Asset',
      'asset_updated': 'Your Asset was Updated',
      'ticket_updated': 'Your Ticket was Updated'
    };
    
    return actionTypeMap[actionType] || actionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get action type color class
   */
  getActionTypeColorClass(actionType: string): string {
    const colorMap: { [key: string]: string } = {
      'asset_allocated': 'bg-green-100 text-green-600',
      'ticket_raised': 'bg-blue-100 text-blue-600',
      'ticket_responded': 'bg-purple-100 text-purple-600',
      'asset_returned': 'bg-yellow-100 text-yellow-600',
      'asset_updated': 'bg-orange-100 text-orange-600',
      'ticket_updated': 'bg-indigo-100 text-indigo-600'
    };
    
    return colorMap[actionType] || 'bg-gray-100 text-gray-600';
  }

  /**
   * Track by function for activity logs performance
   */
  trackByActivityId(index: number, activity: ActivityLog): number {
    return activity.id;
  }

  // Tab navigation
  setActiveTab(tab: string): void {
    this.activeTab = tab;
    
    // Load activity logs when switching to activity logs tab
    if (tab === 'activity-logs' && this.employeeActivityLogs.length === 0) {
      this.loadEmployeeActivityLogs();
    }
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

  // Fetch activity logs for a specific ticket (legacy method for ticket modal)
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
    formData.append('asset_id', this.ticketRequest.deviceId);
    formData.append('issue_description', this.ticketRequest.description);
    formData.append('reported_by', this.user.email);
    formData.append('priority', 'Medium');
    
    if (this.selectedFile) {
      formData.append('files', this.selectedFile);
    }

    this.http.post<any>(`${this.apiUrl}/raise-ticket`, formData).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (response.success) {
          this.showSuccessMessage('Ticket raised successfully!');
          this.closeRaiseTicketModal();
          this.fetchRaisedIssues(); // Refresh the tickets list
          
          // Refresh activity logs if we're on that tab
          if (this.activeTab === 'activity-logs') {
            setTimeout(() => {
              this.loadEmployeeActivityLogs();
            }, 1000);
          }
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
            
            // Refresh activity logs if we're on that tab
            if (this.activeTab === 'activity-logs') {
              setTimeout(() => {
                this.loadEmployeeActivityLogs();
              }, 1000);
            }
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
    if (this.activeTab === 'activity-logs') {
      this.loadEmployeeActivityLogs();
    }
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

  // ==================== UTILITY METHODS ====================

  /**
   * Get activity type icon SVG path
   */
  getActivityTypeIcon(actionType: string): string {
    if (actionType.includes('asset')) {
      return 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z';
    } else if (actionType.includes('ticket')) {
      return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
    } else {
      return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }

  /**
   * Get human readable time difference
   */
  getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return this.datePipe.transform(date, 'mediumDate') || '';
  }

  /**
   * Get activity priority based on type
   */
  getActivityPriority(actionType: string): 'high' | 'medium' | 'low' {
    if (actionType.includes('responded') || actionType.includes('escalated')) {
      return 'high';
    } else if (actionType.includes('ticket') || actionType.includes('allocated')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Check if activity is recent (within last 24 hours)
   */
  isRecentActivity(date: Date): boolean {
    const now = new Date();
    const activityDate = new Date(date);
    const diff = now.getTime() - activityDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return hours < 24;
  }

  /**
   * Get activity summary for dashboard/overview
   */
  getActivitySummary(): { total: number; recent: number; types: { [key: string]: number } } {
    const summary = {
      total: this.employeeActivityLogs.length,
      recent: 0,
      types: {} as { [key: string]: number }
    };

    this.employeeActivityLogs.forEach(activity => {
      // Count recent activities
      if (this.isRecentActivity(activity.created_at)) {
        summary.recent++;
      }

      // Count by type
      const type = this.getActionTypeDisplayName(activity.action_type);
      summary.types[type] = (summary.types[type] || 0) + 1;
    });

    return summary;
  }

  /**
   * Export activity logs to CSV
   */
  exportActivityLogs(): void {
    if (this.employeeActivityLogs.length === 0) {
      this.showErrorMessage('No activity logs to export.');
      return;
    }

    const csvData = this.prepareActivityLogsForExport();
    this.downloadCSV(csvData, `my_activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
  }

  /**
   * Prepare activity logs data for CSV export
   */
  private prepareActivityLogsForExport(): string {
    const headers = [
      'Date',
      'Time',
      'Activity Type',
      'Description',
      'Asset ID',
      'Ticket ID',
      'Performed By'
    ];

    const rows: string[] = [headers.join(',')];

    this.employeeActivityLogs.forEach(activity => {
      const date = new Date(activity.created_at);
      const row = [
        `"${date.toLocaleDateString()}"`,
        `"${date.toLocaleTimeString()}"`,
        `"${this.getActionTypeDisplayName(activity.action_type)}"`,
        `"${activity.action_description || ''}"`,
        `"${activity.asset_id || ''}"`,
        `"${activity.ticket_id || ''}"`,
        `"${activity.performed_by_name || activity.performed_by || ''}"`
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * Download CSV file
   */
  private downloadCSV(csvContent: string, fileName: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Filter activities by type
   */
  filterActivitiesByType(type: string): ActivityLog[] {
    if (!type) return this.employeeActivityLogs;
    
    return this.employeeActivityLogs.filter(activity => 
      activity.action_type.includes(type.toLowerCase())
    );
  }

  /**
   * Filter activities by date range
   */
  filterActivitiesByDateRange(startDate: Date, endDate: Date): ActivityLog[] {
    return this.employeeActivityLogs.filter(activity => {
      const activityDate = new Date(activity.created_at);
      return activityDate >= startDate && activityDate <= endDate;
    });
  }

  /**
   * Search activities by description
   */
  searchActivities(searchTerm: string): ActivityLog[] {
    if (!searchTerm.trim()) return this.employeeActivityLogs;
    
    const term = searchTerm.toLowerCase().trim();
    return this.employeeActivityLogs.filter(activity => 
      activity.action_description.toLowerCase().includes(term) ||
      (activity.asset_id && activity.asset_id.toLowerCase().includes(term)) ||
      (activity.ticket_id && activity.ticket_id.toLowerCase().includes(term))
    );
  }
}