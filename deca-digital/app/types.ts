export interface ShipmentItem {
  id: string;
  trackingNumber: string;
  originAddress: string;
  originCity: string;
  originPostalCode: string;
  destinationAddress: string;
  destinationCity: string;
  destinationPostalCode: string;
  goodsDescription: string;
  goodsCategory: 'General' | 'Perecedera' | 'Peligrosa (ADR)' | 'Fraccionada' | 'Maquinaria';
  packageCount: number;
  grossWeightKg: number;
  shipperName: string;
  consigneeName: string;
}

export interface ModificationLog {
  version: number;
  timestamp: string;
  field?: string;
  reason: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  modifiedBy: string;
  qrHash: string;
}

export interface DecaDocument {
  id: string;
  version: number;
  creationDate: string;
  status: 'BORRADOR' | 'EN_TRANSITO' | 'ENTREGADO' | 'MODIFICADO_EN_RUTA' | 'CANCELADO';
  carrier: {
    companyName: string;
    cif: string;
    address: string;
    driverName: string;
    driverDni: string;
    driverEmail?: string;
    tractorPlate: string;
    trailerPlate?: string;
    phone: string;
  };
  contractualShipper: {
    companyName: string;
    cif: string;
    address: string;
    contactName: string;
  };
  shipments: ShipmentItem[];
  route: {
    originMain: string;
    destinationMain: string;
    plannedStartDate: string;
    plannedDeliveryDate: string;
  };
  history: ModificationLog[];
  digitalSignature: string;
  fileSizeBytes: number;
  legalRetentionExpiresDate: string;
  qrUrl: string;
  observations?: string;
  assignedUserId?: string;
}