import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

interface ActivityLog {
  timestamp: Date;
  message: string;
  user: string;
  device: string;
  issueType: string;
}

interface UserActivity {
  userName: string;
  userInitials: string;
  device: string;
  issueType: string;
  activities: ActivityLog[];
}

interface DateGroup {
  date: Date;
  userActivities: { [key: string]: UserActivity };
}

@Component({
  selector: 'app-asset-management',
  templateUrl: './asset-management-hr.component.html',
  styleUrls: ['./asset-management-hr.component.css']
})
export class AssetManagementComponent implements OnInit {
  currentDate = new Date();
  activeSection = 'assets';
  
  // Vendor Management
  vendorList = [
    { name: 'Tech Suppliers Inc.', contact: 'John Doe', email: 'john@techsuppliers.com' },
    { name: 'Hardware Solutions', contact: 'Jane Smith', email: 'jane@hardwaresolutions.com' },
    { name: 'IT Equipment Co.', contact: 'Robert Johnson', email: 'robert@itequipment.com' }
  ];
  showVendorModal = false;
  vendorForm: FormGroup;
  
  // Ticket Management
  activeTickets = 12;
  closedTickets = 45;
  pendingTickets = 8;
  ticketList = [
    { id: '1001', employee: 'Raj Sharma', status: 'Open', issue: 'Laptop not turning on' },
    { id: '1002', employee: 'Priya Patel', status: 'Pending', issue: 'Monitor flickering' },
    { id: '1003', employee: 'Amit Kumar', status: 'Open', issue: 'Keyboard not working' },
    { id: '1004', employee: 'Sneha Desai', status: 'Resolved', issue: 'Software installation' }
  ];
  selectedTicket: any = null;
  ticketResponse = '';
  
  // Activity Logs
  activityLogs: ActivityLog[] = [
    { timestamp: new Date('2023-10-30T09:15:00'), message: 'Device allocated to Raj Sharma', user: 'Raj Sharma', device: 'MacBook Pro', issueType: 'Hardware Issue' },
    { timestamp: new Date('2023-10-30T10:30:00'), message: 'Issue reported: Laptop not turning on', user: 'Raj Sharma', device: 'MacBook Pro', issueType: 'Hardware Issue' },
    { timestamp: new Date('2023-10-30T11:45:00'), message: 'Technician assigned to ticket', user: 'Raj Sharma', device: 'MacBook Pro', issueType: 'Hardware Issue' },
    { timestamp: new Date('2023-10-30T14:20:00'), message: 'Device repaired and returned', user: 'Raj Sharma', device: 'MacBook Pro', issueType: 'Hardware Issue' },
    { timestamp: new Date('2023-10-29T08:30:00'), message: 'New monitor requested', user: 'Priya Patel', device: 'Dell Monitor', issueType: 'Display Issue' },
    { timestamp: new Date('2023-10-29T09:45:00'), message: 'Monitor replacement approved', user: 'Priya Patel', device: 'Dell Monitor', issueType: 'Display Issue' }
  ];
  
  // Assets
  searchTerm = '';
  statusFilter = '';
  typeFilter = '';
  brandFilter = '';
  vendorFilter = '';
  statusOptions = ['', 'Available', 'Allocated', 'Maintenance', 'Retired'];
  typeOptions = ['', 'Laptop', 'Monitor', 'Keyboard', 'Mouse', 'Desktop'];
  brandOptions = ['', 'Dell', 'HP', 'Apple', 'Lenovo'];
  vendorOptions = ['', 'Tech Suppliers Inc.', 'Hardware Solutions', 'IT Equipment Co.'];
  
  filteredAssets = [
    { assetId: 'AST001', name: 'MacBook Pro', type: 'Laptop', brand: 'Apple', model: 'M1 2021', status: 'Allocated', allocatedTo: 'Raj Sharma', vendor: 'Tech Suppliers Inc.', vendorEmail: 'contact@techsuppliers.com', vendorContact: 'John Doe', warrantyExpiry: new Date('2024-12-15') },
    { assetId: 'AST002', name: 'UltraSharp Monitor', type: 'Monitor', brand: 'Dell', model: 'U2720Q', status: 'Available', allocatedTo: '', vendor: 'Hardware Solutions', vendorEmail: 'sales@hardwaresolutions.com', vendorContact: 'Jane Smith', warrantyExpiry: new Date('2025-03-20') },
    { assetId: 'AST003', name: 'ThinkPad', type: 'Laptop', brand: 'Lenovo', model: 'X1 Carbon', status: 'Maintenance', allocatedTo: 'Amit Kumar', vendor: 'IT Equipment Co.', vendorEmail: 'support@itequipment.com', vendorContact: 'Robert Johnson', warrantyExpiry: new Date('2024-08-10') }
  ];

  constructor(private fb: FormBuilder) {
    this.vendorForm = this.fb.group({
      name: ['', Validators.required],
      contact: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['']
    });
  }

  ngOnInit(): void {}

  // Vendor Modal Functions
  openAddVendorModal(): void {
    this.showVendorModal = true;
  }

  closeAddVendorModal(): void {
    this.showVendorModal = false;
    this.vendorForm.reset();
  }

  onVendorSubmit(): void {
    if (this.vendorForm.valid) {
      this.vendorList.push(this.vendorForm.value);
      this.closeAddVendorModal();
    }
  }

  // Ticket Functions
  openTicketAction(ticket: any): void {
    this.selectedTicket = {...ticket};
    this.ticketResponse = '';
  }

  submitTicketAction(): void {
    if (this.selectedTicket && this.ticketResponse) {
      // Update ticket status and add to activity logs
      const index = this.ticketList.findIndex(t => t.id === this.selectedTicket.id);
      if (index !== -1) {
        this.ticketList[index].status = this.selectedTicket.status;
      }
      
      // Add to activity logs
      this.activityLogs.unshift({
        timestamp: new Date(),
        message: `Ticket #${this.selectedTicket.id} updated: ${this.ticketResponse}`,
        user: this.selectedTicket.employee,
        device: 'N/A',
        issueType: 'Ticket Update'
      });
      
      this.selectedTicket = null;
    }
  }

  // Activity Logs Grouping
  get groupedActivityLogs() {
    const grouped: { [key: string]: DateGroup } = {};
    
    this.activityLogs.forEach(log => {
      const dateStr = log.timestamp.toDateString();
      if (!grouped[dateStr]) {
        grouped[dateStr] = {
          date: log.timestamp,
          userActivities: {}
        };
      }
      
      const userKey = `${log.user}-${log.device}-${log.issueType}`;
      if (!grouped[dateStr].userActivities[userKey]) {
        grouped[dateStr].userActivities[userKey] = {
          userName: log.user,
          userInitials: this.getInitials(log.user),
          device: log.device,
          issueType: log.issueType,
          activities: []
        };
      }
      
      grouped[dateStr].userActivities[userKey].activities.push(log);
    });
    
    // Convert to array format and sort
    return Object.keys(grouped).map(date => {
      return {
        date: grouped[date].date,
        userActivities: Object.values(grouped[date].userActivities)
      };
    }).sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  // Filter functions for assets
  onSearchChange(event: any): void {
    this.searchTerm = event.target.value;
    this.applyFilters();
  }

  onStatusFilterChange(event: any): void {
    this.statusFilter = event.target.value;
    this.applyFilters();
  }

  onTypeFilterChange(event: any): void {
    this.typeFilter = event.target.value;
    this.applyFilters();
  }

  onBrandFilterChange(event: any): void {
    this.brandFilter = event.target.value;
    this.applyFilters();
  }

  onVendorFilterChange(event: any): void {
    this.vendorFilter = event.target.value;
    this.applyFilters();
  }

  applyFilters(): void {
    // In a real application, this would filter your data based on all selected filters
    console.log('Filters applied:', {
      searchTerm: this.searchTerm,
      statusFilter: this.statusFilter,
      typeFilter: this.typeFilter,
      brandFilter: this.brandFilter,
      vendorFilter: this.vendorFilter
    });
  }
}