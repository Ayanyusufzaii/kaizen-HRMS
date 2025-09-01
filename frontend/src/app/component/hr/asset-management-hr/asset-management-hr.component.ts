import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

interface Evidence {
  type: 'image' | 'video';
  url: string;
}

interface ActivityLog {
  timestamp: Date;
  message: string;
  user: string;
  device: string;
  issueType: string;
  addedBy: 'HR' | 'Employee';
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

export interface Asset {
  id?: number;
  assetId: string;  // Changed from asset_id to assetId
  name: string;
  type: string;
  brand: string;
  model: string;
  status: string;
  allocatedTo?: string;  // Changed from allocated_to
  vendor: string;
  vendorEmail?: string;  // Changed from vendor_email
  vendorContact?: string;  // Changed from vendor_contact
  warrantyExpiry?: string;  // Changed from warranty_expiry
  purchaseDate?: string;  // Changed from purchase_date
  purchaseCost?: number;  // Changed from purchase_cost
}

export interface Vendor {
  id?: number;
  name: string;
  contact: string;  // Changed to match template
  email: string;
  phone?: string;
  address?: string;
}

export interface AssetResponse {
  success: boolean;
  data: Asset[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface Ticket {
  id: string;
  employee: string;
  status: string;
  issue: string;
  evidence: Evidence[];
}

@Component({
  selector: 'app-asset-management',
  templateUrl: './asset-management-hr.component.html',
  styleUrls: ['./asset-management-hr.component.css']
})
export class AssetManagementComponent implements OnInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('vendorPaginator') vendorPaginator!: MatPaginator;
  @ViewChild('ticketPaginator') ticketPaginator!: MatPaginator;

  isSidebarMinimized = false;
  currentDate = new Date();
  activeSection = 'assets';
  
  // Vendor Management
  vendorList: Vendor[] = [];
  vendorDataSource: MatTableDataSource<Vendor>;
  vendorDisplayedColumns: string[] = ['name', 'contact', 'email', 'actions'];
  showVendorModal = false;
  editingVendor: Vendor | null = null;
  vendorForm: FormGroup;
  
  // Asset Management
  showAssetModal = false;
  editingAsset: Asset | null = null;
  assetForm: FormGroup;
  assetDataSource: MatTableDataSource<Asset>;
  assetDisplayedColumns: string[] = [
    'assetId', 'name', 'type', 'brandModel', 'status', 
    'allocatedTo', 'vendor', 'vendorContact', 'warrantyExpiry', 'actions'
  ];
  
  // Filter Controls
  searchControl = new FormControl('');
  statusControl = new FormControl('');
  typeControl = new FormControl('');
  brandControl = new FormControl('');
  vendorControl = new FormControl('');
  
  // Filter Options - Include empty option at the beginning
  statusOptions: string[] = ['', 'Available', 'Allocated', 'Maintenance', 'Retired'];
  typeOptions: string[] = ['', 'Laptop', 'Monitor', 'Keyboard', 'Mouse', 'Desktop', 'Printer', 'Server', 'Tablet'];
  brandOptions: string[] = ['', 'Dell', 'HP', 'Apple', 'Lenovo', 'Samsung', 'Acer', 'Asus', 'Microsoft'];
  vendorOptions: string[] = [''];
  
  // Assets Data
  assets: Asset[] = [];
  totalAssets = 0;
  currentPage = 1;
  pageSize = 10;
  isLoading = false;

  // Ticket Management
  activeTickets = 12;
  closedTickets = 45;
  pendingTickets = 8;
  ticketList: Ticket[] = [
    { 
      id: '1001', 
      employee: 'Raj Sharma', 
      status: 'Open', 
      issue: 'Laptop not turning on',
      evidence: [
        { type: 'image', url: 'https://example.com/image1.jpg' },
        { type: 'video', url: 'https://example.com/video1.mp4' }
      ]
    },
    { 
      id: '1002', 
      employee: 'Priya Patel', 
      status: 'Pending', 
      issue: 'Monitor flickering',
      evidence: [
        { type: 'image', url: 'https://example.com/image2.jpg' }
      ]
    },
    { 
      id: '1003', 
      employee: 'Amit Kumar', 
      status: 'Open', 
      issue: 'Keyboard not working',
      evidence: []
    },
    { 
      id: '1004', 
      employee: 'Sneha Desai', 
      status: 'Closed', 
      issue: 'Software installation',
      evidence: []
    }
  ];
  ticketDataSource: MatTableDataSource<Ticket>;
  ticketDisplayedColumns: string[] = ['id', 'employee', 'status', 'issue', 'evidence', 'actions'];
  selectedTicket: Ticket | null = null;
  ticketResponse = '';
  informationRequest = '';
  selectedEvidence: Evidence | null = null;
  
  // Activity Logs
  activityLogs: ActivityLog[] = [
    { 
      timestamp: new Date('2023-10-30T09:15:00'), 
      message: 'Device allocated to Raj Sharma', 
      user: 'Raj Sharma', 
      device: 'MacBook Pro', 
      issueType: 'Hardware Issue',
      addedBy: 'HR'
    },
    { 
      timestamp: new Date('2023-10-30T10:30:00'), 
      message: 'Issue reported: Laptop not turning on', 
      user: 'Raj Sharma', 
      device: 'MacBook Pro', 
      issueType: 'Hardware Issue',
      addedBy: 'Employee'
    },
    { 
      timestamp: new Date('2023-10-30T11:45:00'), 
      message: 'Technician assigned to ticket', 
      user: 'Raj Sharma', 
      device: 'MacBook Pro', 
      issueType: 'Hardware Issue',
      addedBy: 'HR'
    },
    { 
      timestamp: new Date('2023-10-30T14:20:00'), 
      message: 'Device repaired and returned', 
      user: 'Raj Sharma', 
      device: 'MacBook Pro', 
      issueType: 'Hardware Issue',
      addedBy: 'HR'
    },
    { 
      timestamp: new Date('2023-10-29T08:30:00'), 
      message: 'New monitor requested', 
      user: 'Priya Patel', 
      device: 'Dell Monitor', 
      issueType: 'Display Issue',
      addedBy: 'Employee'
    },
    { 
      timestamp: new Date('2023-10-29T09:45:00'), 
      message: 'Monitor replacement approved', 
      user: 'Priya Patel', 
      device: 'Dell Monitor', 
      issueType: 'Display Issue',
      addedBy: 'HR'
    }
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    // Initialize vendor form with correct field names
    this.vendorForm = this.fb.group({
      name: ['', Validators.required],
      contact: ['', Validators.required],  // Changed from contact_person
      email: ['', [Validators.required, Validators.email]],
      phone: ['']
    });
    
    // Initialize asset form with correct field names matching template
    this.assetForm = this.fb.group({
      assetId: ['', Validators.required],  // Changed from asset_id
      name: ['', Validators.required],
      type: ['', Validators.required],
      brand: ['', Validators.required],
      model: ['', Validators.required],
      status: ['Available', Validators.required],
      allocatedTo: [''],  // Changed from allocated_to
      vendor: ['', Validators.required],
      vendorEmail: ['', [Validators.required, Validators.email]],  // Changed from vendor_email
      vendorContact: ['', Validators.required],  // Changed from vendor_contact
      warrantyExpiry: [''],  // Changed from warranty_expiry
      purchaseDate: [''],  // Changed from purchase_date
      purchaseCost: ['']  // Changed from purchase_cost
    });
    
    // Initialize data sources
    this.vendorDataSource = new MatTableDataSource(this.vendorList);
    this.assetDataSource = new MatTableDataSource(this.assets);
    this.ticketDataSource = new MatTableDataSource(this.ticketList);
  }

  ngOnInit(): void {
    this.loadAssets();
    this.loadVendors();
    this.setupFilterSubscriptions();
  }

  ngAfterViewInit() {
    this.assetDataSource.sort = this.sort;
    this.assetDataSource.paginator = this.paginator;
    this.vendorDataSource.paginator = this.vendorPaginator;
    this.ticketDataSource.paginator = this.ticketPaginator;
    
    // Set up custom filter predicate after view init
    this.setCustomFilterPredicate();
  }

  setupFilterSubscriptions(): void {
    // Set up filter subscriptions
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.applyFilters();
      });
    
    this.statusControl.valueChanges.subscribe(() => this.applyFilters());
    this.typeControl.valueChanges.subscribe(() => this.applyFilters());
    this.brandControl.valueChanges.subscribe(() => this.applyFilters());
    this.vendorControl.valueChanges.subscribe(() => this.applyFilters());
  }

  onSidebarToggle(isMinimized: boolean) {
    this.isSidebarMinimized = isMinimized;
  }

  // ==================== ASSET MANAGEMENT FUNCTIONS ====================

  // Convert backend response to frontend format
  private mapAssetFromAPI(apiAsset: any): Asset {
    return {
      id: apiAsset.id,
      assetId: apiAsset.asset_id,
      name: apiAsset.name,
      type: apiAsset.type,
      brand: apiAsset.brand,
      model: apiAsset.model,
      status: apiAsset.status,
      allocatedTo: apiAsset.allocated_to,
      vendor: apiAsset.vendor,
      vendorEmail: apiAsset.vendor_email,
      vendorContact: apiAsset.vendor_contact,
      warrantyExpiry: apiAsset.warranty_expiry,
      purchaseDate: apiAsset.purchase_date,
      purchaseCost: apiAsset.purchase_cost
    };
  }

  // Convert frontend format to backend format
  private mapAssetToAPI(asset: Asset): any {
    return {
      asset_id: asset.assetId,
      name: asset.name,
      type: asset.type,
      brand: asset.brand,
      model: asset.model,
      status: asset.status,
      allocated_to: asset.allocatedTo,
      vendor: asset.vendor,
      vendor_email: asset.vendorEmail,
      vendor_contact: asset.vendorContact,
      warranty_expiry: asset.warrantyExpiry,
      purchase_date: asset.purchaseDate,
      purchase_cost: asset.purchaseCost
    };
  }

  // Apply filters to the assets table
  applyFilters(): void {
    const search = this.searchControl.value?.toLowerCase() || '';
    const status = this.statusControl.value || '';
    const type = this.typeControl.value || '';
    const brand = this.brandControl.value || '';
    const vendor = this.vendorControl.value || '';
    
    this.assetDataSource.filter = JSON.stringify({
      search, status, type, brand, vendor
    });
    
    if (this.assetDataSource.paginator) {
      this.assetDataSource.paginator.firstPage();
    }
  }

  // Custom filter predicate for multiple filters
  setCustomFilterPredicate() {
    this.assetDataSource.filterPredicate = (data: Asset, filter: string): boolean => {
      const filterObject = JSON.parse(filter);
      const searchStr = filterObject.search;
      
      const matchesSearch = !searchStr || 
        data.assetId.toLowerCase().includes(searchStr) ||
        data.name.toLowerCase().includes(searchStr) ||
        data.type.toLowerCase().includes(searchStr) ||
        data.brand.toLowerCase().includes(searchStr) ||
        data.model.toLowerCase().includes(searchStr) ||
        (data.allocatedTo && data.allocatedTo.toLowerCase().includes(searchStr)) ||
        data.vendor.toLowerCase().includes(searchStr);
      
      const matchesStatus = !filterObject.status || data.status === filterObject.status;
      const matchesType = !filterObject.type || data.type === filterObject.type;
      const matchesBrand = !filterObject.brand || data.brand === filterObject.brand;
      const matchesVendor = !filterObject.vendor || data.vendor === filterObject.vendor;
      
      return matchesSearch && matchesStatus && matchesType && matchesBrand && matchesVendor;
    };
  }

  // Load assets from API
  loadAssets(): void {
    this.isLoading = true;
    
    this.http.get<any>('http://localhost:3000/api/assets')
      .subscribe({
        next: (response) => {
          console.log('API Response:', response);
          if (response.success && response.data) {
            // Map API response to frontend format
            this.assets = response.data.map((asset: any) => this.mapAssetFromAPI(asset));
            this.assetDataSource.data = this.assets;
            this.totalAssets = response.pagination?.total || this.assets.length;
            
            // Apply filters after data is loaded
            setTimeout(() => {
              this.setCustomFilterPredicate();
              this.applyFilters();
            });
          } else {
            console.error('Failed to load assets - Invalid response format');
            this.useDemoAssets();
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading assets:', error);
          this.useDemoAssets();
          this.isLoading = false;
        }
      });
  }

  // Use demo assets if API fails
  useDemoAssets(): void {
    this.assets = [
      { 
        assetId: 'AST001', 
        name: 'MacBook Pro', 
        type: 'Laptop', 
        brand: 'Apple', 
        model: 'M1 2021', 
        status: 'Allocated', 
        allocatedTo: 'Raj Sharma', 
        vendor: 'Tech Suppliers Inc.', 
        vendorEmail: 'contact@techsuppliers.com', 
        vendorContact: 'John Doe', 
        warrantyExpiry: '2024-12-15' 
      },
      { 
        assetId: 'AST002', 
        name: 'UltraSharp Monitor', 
        type: 'Monitor', 
        brand: 'Dell', 
        model: 'U2720Q', 
        status: 'Available', 
        allocatedTo: '', 
        vendor: 'Hardware Solutions', 
        vendorEmail: 'sales@hardwaresolutions.com', 
        vendorContact: 'Jane Smith', 
        warrantyExpiry: '2025-03-20' 
      },
      { 
        assetId: 'AST003', 
        name: 'ThinkPad', 
        type: 'Laptop', 
        brand: 'Lenovo', 
        model: 'X1 Carbon', 
        status: 'Maintenance', 
        allocatedTo: 'Amit Kumar', 
        vendor: 'IT Equipment Co.', 
        vendorEmail: 'support@itequipment.com', 
        vendorContact: 'Robert Johnson', 
        warrantyExpiry: '2024-08-10' 
      }
    ];
    this.assetDataSource.data = this.assets;
    this.totalAssets = this.assets.length;
    
    setTimeout(() => {
      this.setCustomFilterPredicate();
      this.applyFilters();
    });
  }

  // Load vendors from API
  loadVendors(): void {
    this.http.get<{ success: boolean; data: any[] }>('http://localhost:3000/api/vendors')
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Map vendor data to match interface
            this.vendorList = response.data.map(vendor => ({
              id: vendor.id,
              name: vendor.name,
              contact: vendor.contact_person, // Map contact_person to contact
              email: vendor.email,
              phone: vendor.phone
            }));
            this.vendorDataSource.data = this.vendorList;
            
            // Update vendor options for dropdowns
            this.vendorOptions = ['', ...this.vendorList.map(v => v.name)];
          } else {
            this.useDemoVendors();
          }
        },
        error: (error) => {
          console.error('Error loading vendors:', error);
          this.useDemoVendors();
        }
      });
  }

  // Use demo vendors if API fails
  useDemoVendors(): void {
    this.vendorList = [
      { name: 'Tech Suppliers Inc.', contact: 'John Doe', email: 'john@techsuppliers.com' },
      { name: 'Hardware Solutions', contact: 'Jane Smith', email: 'jane@hardwaresolutions.com' },
      { name: 'IT Equipment Co.', contact: 'Robert Johnson', email: 'robert@itequipment.com' }
    ];
    this.vendorDataSource.data = this.vendorList;
    this.vendorOptions = ['', ...this.vendorList.map(v => v.name)];
  }

  // Handle pagination events
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadAssets();
  }

  // Open Add Asset Modal
  openAddAssetModal(): void {
    this.editingAsset = null;
    this.assetForm.reset({
      status: 'Available'
    });
    this.showAssetModal = true;
  }

  // Edit Asset
  editAsset(asset: Asset): void {
    this.editingAsset = asset;
    this.assetForm.patchValue({
      assetId: asset.assetId,
      name: asset.name,
      type: asset.type,
      brand: asset.brand,
      model: asset.model,
      status: asset.status,
      allocatedTo: asset.allocatedTo,
      vendor: asset.vendor,
      vendorEmail: asset.vendorEmail,
      vendorContact: asset.vendorContact,
      warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.split('T')[0] : '',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
      purchaseCost: asset.purchaseCost
    });
    this.showAssetModal = true;
  }

  // Close Add Asset Modal
  closeAddAssetModal(): void {
    this.showAssetModal = false;
    this.editingAsset = null;
    this.assetForm.reset();
  }

  // Submit Asset Form
  onAssetSubmit(): void {
    if (this.assetForm.valid) {
      const formValue = this.assetForm.value;
      
      // Convert frontend format to backend format
      const apiPayload = this.mapAssetToAPI(formValue);
      
      // Convert empty strings to null for optional fields
      Object.keys(apiPayload).forEach(key => {
        if (apiPayload[key] === '') {
          apiPayload[key] = null;
        }
      });
      
      if (this.editingAsset) {
        // Update existing asset
        this.http.put(`http://localhost:3000/api/assets/${this.editingAsset.assetId}`, apiPayload)
          .subscribe({
            next: (response: any) => {
              if (response.success) {
                this.loadAssets(); // Reload to get fresh data
                this.closeAddAssetModal();
                alert('Asset updated successfully!');
              } else {
                alert('Failed to update asset. Please try again.');
              }
            },
            error: (error) => {
              console.error('Error updating asset:', error);
              alert('Error updating asset. Please try again.');
            }
          });
      } else {
        // Create new asset
        this.http.post('http://localhost:3000/api/assets', apiPayload)
          .subscribe({
            next: (response: any) => {
              console.log('Asset creation response:', response);
              if (response.success) {
                this.loadAssets(); // Reload to get fresh data including the new asset
                this.closeAddAssetModal();
                alert('Asset added successfully!');
              } else {
                alert('Failed to add asset. Please try again.');
              }
            },
            error: (error) => {
              console.error('Error creating asset:', error);
              alert('Error creating asset. Please try again.');
            }
          });
      }
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.assetForm.controls).forEach(key => {
        this.assetForm.get(key)?.markAsTouched();
      });
      alert('Please fill all required fields correctly.');
    }
  }

  // Delete Asset
  deleteAsset(asset: Asset): void {
    if (confirm(`Are you sure you want to delete asset ${asset.assetId}?`)) {
      this.http.delete(`http://localhost:3000/api/assets/${asset.assetId}`)
        .subscribe({
          next: (response: any) => {
            if (response.success) {
              this.loadAssets(); // Reload to refresh the table
              alert('Asset deleted successfully!');
            } else {
              alert('Failed to delete asset. Please try again.');
            }
          },
          error: (error) => {
            console.error('Error deleting asset:', error);
            alert('Error deleting asset. Please try again.');
          }
        });
    }
  }

  // ==================== VENDOR MANAGEMENT FUNCTIONS ====================

  openAddVendorModal(): void {
    this.editingVendor = null;
    this.vendorForm.reset();
    this.showVendorModal = true;
  }

  editVendor(vendor: Vendor): void {
    this.editingVendor = vendor;
    this.vendorForm.patchValue(vendor);
    this.showVendorModal = true;
  }

  closeAddVendorModal(): void {
    this.showVendorModal = false;
    this.editingVendor = null;
    this.vendorForm.reset();
  }

  onVendorSubmit(): void {
    if (this.vendorForm.valid) {
      const formValue = this.vendorForm.value;
      
      // Convert to backend format
      const apiPayload = {
        name: formValue.name,
        contact_person: formValue.contact,
        email: formValue.email,
        phone: formValue.phone || null
      };
      
      if (this.editingVendor) {
        // Update existing vendor
        this.http.put(`http://localhost:3000/api/vendors/${this.editingVendor.id}`, apiPayload)
          .subscribe({
            next: (response: any) => {
              if (response.success) {
                this.loadVendors(); // Reload vendors
                this.closeAddVendorModal();
                alert('Vendor updated successfully!');
              } else {
                alert('Failed to update vendor. Please try again.');
              }
            },
            error: (error) => {
              console.error('Error updating vendor:', error);
              alert('Error updating vendor. Please try again.');
            }
          });
      } else {
        // Create new vendor
        this.http.post('http://localhost:3000/api/vendors', apiPayload)
          .subscribe({
            next: (response: any) => {
              if (response.success) {
                this.loadVendors(); // Reload vendors
                this.closeAddVendorModal();
                alert('Vendor added successfully!');
              } else {
                alert('Failed to add vendor. Please try again.');
              }
            },
            error: (error) => {
              console.error('Error creating vendor:', error);
              alert('Error creating vendor. Please try again.');
            }
          });
      }
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.vendorForm.controls).forEach(key => {
        this.vendorForm.get(key)?.markAsTouched();
      });
      alert('Please fill all required fields correctly.');
    }
  }

  deleteVendor(vendor: Vendor): void {
    if (confirm(`Are you sure you want to delete vendor ${vendor.name}?`)) {
      this.http.delete(`http://localhost:3000/api/vendors/${vendor.id}`)
        .subscribe({
          next: (response: any) => {
            if (response.success) {
              this.loadVendors(); // Reload vendors
              alert('Vendor deleted successfully!');
            } else {
              alert('Failed to delete vendor. Please try again.');
            }
          },
          error: (error) => {
            console.error('Error deleting vendor:', error);
            alert('Error deleting vendor. Please try again.');
          }
        });
    }
  }

  // ==================== TICKET FUNCTIONS ====================

  openTicketAction(ticket: Ticket): void {
    this.selectedTicket = {...ticket};
    this.ticketResponse = '';
    this.informationRequest = '';
  }

  submitTicketAction(): void {
    if (this.selectedTicket) {
      // Update ticket status
      const index = this.ticketList.findIndex(t => t.id === this.selectedTicket!.id);
      if (index !== -1) {
        this.ticketList[index].status = this.selectedTicket!.status;
        this.ticketDataSource.data = [...this.ticketList];
      }
      
      // Add to activity logs for HR response
      if (this.ticketResponse) {
        this.activityLogs.unshift({
          timestamp: new Date(),
          message: `HR Response: ${this.ticketResponse}`,
          user: this.selectedTicket.employee,
          device: 'N/A',
          issueType: 'Ticket Update',
          addedBy: 'HR'
        });
      }
      
      // Add to activity logs for information request
      if (this.informationRequest) {
        this.activityLogs.unshift({
          timestamp: new Date(),
          message: `Information Request: ${this.informationRequest}`,
          user: this.selectedTicket.employee,
          device: 'N/A',
          issueType: 'Information Request',
          addedBy: 'HR'
        });
      }
      
      this.selectedTicket = null;
    }
  }

  openEvidenceModal(evidence: Evidence): void {
    this.selectedEvidence = evidence;
  }

  // ==================== ACTIVITY LOGS ====================

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
}