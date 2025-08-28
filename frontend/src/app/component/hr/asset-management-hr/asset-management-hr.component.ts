import { Component, OnInit } from '@angular/core';

interface Asset {
  id: number;
  assetId: string;
  name: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  status: string;
  allocatedTo?: string;
  vendor: string;
  vendorContact: string;
  vendorEmail: string;
  warrantyExpiry: string;
}

@Component({
  selector: 'app-asset-management-hr',
  templateUrl: './asset-management-hr.component.html',
  styleUrls: ['./asset-management-hr.component.css']
})
export class AssetManagementHrComponent implements OnInit {
  assets: Asset[] = [];
  searchTerm: string = '';
  statusFilter: string = '';
  typeFilter: string = '';
  brandFilter: string = '';
  vendorFilter: string = '';
  currentDate: Date = new Date();

  // For dropdown options
  statusOptions: string[] = [];
  typeOptions: string[] = [];
  brandOptions: string[] = [];
  vendorOptions: string[] = [];

  constructor() { }

  ngOnInit() {
    this.loadAssets();
  }

  loadAssets(): void {
    // Mock data for UI demonstration with vendor details
    this.assets = [
  {
    id: 1,
    assetId: 'AST001',
    name: 'Dell Latitude Laptop',
    type: 'Laptop',
    brand: 'Dell',
    model: 'Latitude 5420',
    serialNumber: 'DL123456IN',
    purchaseDate: '2023-01-15',
    status: 'Allocated',
    allocatedTo: 'raj.sharma@example.com',
    vendor: 'Redington India Ltd.',
    vendorContact: 'Vikram Mehta - +91 98765 43210',
    vendorEmail: 'vikram.mehta@redington.com',
    warrantyExpiry: '2025-01-15'
  },
  {
    id: 2,
    assetId: 'AST002',
    name: 'HP All-in-One Desktop',
    type: 'Desktop',
    brand: 'HP',
    model: 'EliteOne 800 G5',
    serialNumber: 'HP789012IN',
    purchaseDate: '2023-02-20',
    status: 'Available',
    allocatedTo: '',
    vendor: 'Ingram Micro India',
    vendorContact: 'Priya Singh - +91 87654 32109',
    vendorEmail: 'priya.singh@ingrammicro.com',
    warrantyExpiry: '2025-02-20'
  },
  {
    id: 3,
    assetId: 'AST003',
    name: 'Apple MacBook Air',
    type: 'Laptop',
    brand: 'Apple',
    model: 'MacBook Air M2',
    serialNumber: 'AP345678IN',
    purchaseDate: '2023-03-10',
    status: 'Maintenance',
    allocatedTo: 'aisha.patel@example.com',
    vendor: 'Rashi Peripherals Pvt. Ltd.',
    vendorContact: 'Support Desk - +91 1800 425 4664',
    vendorEmail: 'support@rptechindia.com',
    warrantyExpiry: '2024-03-10'
  },
  {
    id: 4,
    assetId: 'AST004',
    name: 'Lenovo ThinkPad',
    type: 'Laptop',
    brand: 'Lenovo',
    model: 'ThinkPad X1 Carbon',
    serialNumber: 'LN901234IN',
    purchaseDate: '2023-04-05',
    status: 'Allocated',
    allocatedTo: 'amit.kumar@example.com',
    vendor: 'Savex Computers Ltd.',
    vendorContact: 'Rahul Desai - +91 98976 54321',
    vendorEmail: 'rahul.desai@savex.in',
    warrantyExpiry: '2025-04-05'
  },
  {
    id: 5,
    assetId: 'AST005',
    name: 'Samsung Curved Monitor',
    type: 'Monitor',
    brand: 'Samsung',
    model: 'Odyssey G5 27"',
    serialNumber: 'SS567890IN',
    purchaseDate: '2023-05-12',
    status: 'Available',
    allocatedTo: '',
    vendor: 'Neoteric Informatique Ltd.',
    vendorContact: 'Neha Gupta - +91 81234 56789',
    vendorEmail: 'neha.gupta@neoteric.co.in',
    warrantyExpiry: '2025-05-12'
  },
  {
    id: 6,
    assetId: 'AST006',
    name: 'TP-Link Multi-Gigabit Switch',
    type: 'Network',
    brand: 'TP-Link',
    model: 'TL-SG108-M2',
    serialNumber: 'TP112233IN',
    purchaseDate: '2023-06-18',
    status: 'Allocated',
    allocatedTo: 'it.infrastructure@example.com',
    vendor: 'Daisytek India',
    vendorContact: 'Arjun Reddy - +91 90000 12345',
    vendorEmail: 'arjun.reddy@daisytek.com',
    warrantyExpiry: '2026-06-18'
  }
]
    
    // Initialize filter options
    this.statusOptions = ['', ...this.uniqueStatuses];
    this.typeOptions = ['', ...this.uniqueTypes];
    this.brandOptions = ['', ...this.uniqueBrands];
    this.vendorOptions = ['', ...this.uniqueVendors];
  }

  updateAssetStatus(assetId: number, status: string): void {
    // Mock implementation for UI demonstration
    const asset = this.assets.find(a => a.id === assetId);
    if (asset) {
      const oldStatus = asset.status;
      asset.status = status;
      
      if (status === 'Available') {
        asset.allocatedTo = '';
      }
      
      alert(`Asset ${asset.assetId} status changed from ${oldStatus} to ${status}`);
    }
  }

  onSearchChange(event: any): void {
    this.searchTerm = event.target.value;
  }

  onStatusFilterChange(event: any): void {
    this.statusFilter = event.target.value;
  }

  onTypeFilterChange(event: any): void {
    this.typeFilter = event.target.value;
  }

  onBrandFilterChange(event: any): void {
    this.brandFilter = event.target.value;
  }

  onVendorFilterChange(event: any): void {
    this.vendorFilter = event.target.value;
  }

  get filteredAssets() {
    return this.assets.filter(asset =>
      (asset.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
       asset.assetId.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
       (asset.allocatedTo && asset.allocatedTo.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
       asset.vendor.toLowerCase().includes(this.searchTerm.toLowerCase())) &&
      (this.statusFilter === '' || asset.status === this.statusFilter) &&
      (this.typeFilter === '' || asset.type === this.typeFilter) &&
      (this.brandFilter === '' || asset.brand === this.brandFilter) &&
      (this.vendorFilter === '' || asset.vendor === this.vendorFilter)
    );
  }

  get uniqueTypes(): string[] {
    return [...new Set(this.assets.map(asset => asset.type))];
  }

  get uniqueBrands(): string[] {
    return [...new Set(this.assets.map(asset => asset.brand))];
  }

  get uniqueStatuses(): string[] {
    return [...new Set(this.assets.map(asset => asset.status))];
  }

  get uniqueVendors(): string[] {
    return [...new Set(this.assets.map(asset => asset.vendor))];
  }
}