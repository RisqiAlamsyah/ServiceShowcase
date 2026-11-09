// Data yang sudah dimuat dari server (tepercaya). Harga dalam rupiah bilangan bulat.
export type BookingPackage = {
  id: string;
  title: string;
  basePrice: number;
};

export type BookingAddon = {
  id: string;
  name: string;
  price: number;
};

export type EstimateLine = {
  id: string;
  label: string;
  price: number;
};

export type Estimate = {
  package: EstimateLine;
  addons: EstimateLine[];
  total: number;
};

// Batas jumlah add-on per pemesanan (mencegah payload dan pesan WA yang membengkak).
export const MAX_ADDONS = 20;
