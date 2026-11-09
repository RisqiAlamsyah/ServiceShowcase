import type { PublicPackageOffer } from "./types";

// Data contoh untuk halaman demo (belum ada database). Semua fiktif.
// Nomor di bawah bukan nomor nyata dan tidak pernah dibuka: mode demo hanya menampilkan pratinjau teks.
export const SAMPLE_VENDOR = {
  name: "Studio Contoh MUA",
  phone: "+62 812-0000-0000",
} as const;

export const SAMPLE_PACKAGES: PublicPackageOffer[] = [
  {
    id: "pkg-akad-resepsi",
    title: "Paket Akad & Resepsi",
    description: "Makeup pengantin dan hairdo untuk akad dan resepsi, dua kali ganti tampilan.",
    basePrice: 2_500_000,
    addons: [
      { id: "addon-ibu-kandung", name: "Makeup Ibu Kandung", price: 350_000 },
      { id: "addon-hairdo-keluarga", name: "Hairdo Keluarga", price: 200_000 },
      { id: "addon-touch-up", name: "Touch Up Resepsi", price: 150_000 },
    ],
  },
  {
    id: "pkg-wisuda",
    title: "Paket Wisuda",
    description: "Makeup natural tahan seharian untuk wisuda dan sesi foto.",
    basePrice: 450_000,
    addons: [{ id: "addon-bulu-mata", name: "Bulu Mata Premium", price: 75_000 }],
  },
];
