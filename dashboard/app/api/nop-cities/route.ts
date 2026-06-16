import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const NOP_CITIES: { id: number; city: string; region_id: number }[] = [
  // R01 Sumbagut
  { id:1, city:'ACEH', region_id:1 }, { id:2, city:'BINJAI', region_id:1 },
  { id:3, city:'MEDAN', region_id:1 }, { id:4, city:'PADANG SIDEMPUAN', region_id:1 },
  { id:5, city:'PEMATANG SIANTAR', region_id:1 }, { id:6, city:'RANTAU PRAPAT', region_id:1 },
  // R10 Sumbagteng
  { id:7, city:'BATAM', region_id:10 }, { id:8, city:'BUKITTINGGI', region_id:10 },
  { id:9, city:'DUMAI', region_id:10 }, { id:10, city:'PADANG', region_id:10 },
  { id:11, city:'PEKANBARU', region_id:10 },
  // R02 Sumbagsel
  { id:12, city:'BENGKULU', region_id:2 }, { id:13, city:'JAMBI', region_id:2 },
  { id:14, city:'LAMPUNG', region_id:2 }, { id:15, city:'PALEMBANG', region_id:2 },
  { id:16, city:'PANGKAL PINANG', region_id:2 },
  // R03 Jabotabek
  { id:17, city:'NORTHERN JAKARTA', region_id:3 }, { id:18, city:'SOUTHERN JAKARTA', region_id:3 },
  { id:19, city:'SERANG', region_id:3 }, { id:20, city:'TANGERANG', region_id:3 },
  // R12 Jabodetabek
  { id:21, city:'BEKASI', region_id:12 }, { id:22, city:'BOGOR', region_id:12 },
  { id:23, city:'KARAWANG', region_id:12 },
  // R04 Jabar
  { id:24, city:'BANDUNG', region_id:4 }, { id:25, city:'CIREBON', region_id:4 },
  { id:26, city:'SOREANG', region_id:4 }, { id:27, city:'TASIKMALAYA', region_id:4 },
  // R05 Jateng
  { id:28, city:'MAGELANG', region_id:5 }, { id:29, city:'PEKALONGAN', region_id:5 },
  { id:30, city:'PURWOKERTO', region_id:5 }, { id:31, city:'SEMARANG', region_id:5 },
  { id:32, city:'SURAKARTA', region_id:5 }, { id:33, city:'YOGYAKARTA', region_id:5 },
  // R06 Jatim
  { id:34, city:'JEMBER', region_id:6 }, { id:35, city:'LAMONGAN', region_id:6 },
  { id:36, city:'MADIUN', region_id:6 }, { id:37, city:'MALANG', region_id:6 },
  { id:38, city:'SIDOARJO', region_id:6 }, { id:39, city:'SURABAYA', region_id:6 },
  // R07 Bali Nusra
  { id:40, city:'DENPASAR', region_id:7 }, { id:41, city:'FLORES', region_id:7 },
  { id:42, city:'KUPANG', region_id:7 }, { id:43, city:'MATARAM', region_id:7 },
  // R08 Kalimantan
  { id:44, city:'BALIKPAPAN', region_id:8 }, { id:45, city:'BANJARMASIN', region_id:8 },
  { id:46, city:'PALANGKARAYA', region_id:8 }, { id:47, city:'PANGKALAN BUN', region_id:8 },
  { id:48, city:'PONTIANAK', region_id:8 }, { id:49, city:'SAMARINDA', region_id:8 },
  { id:50, city:'TARAKAN', region_id:8 },
  // R09 Sulawesi
  { id:51, city:'BONE', region_id:9 }, { id:52, city:'KENDARI', region_id:9 },
  { id:53, city:'MAKASSAR', region_id:9 }, { id:54, city:'MANADO', region_id:9 },
  { id:55, city:'PALU', region_id:9 }, { id:56, city:'PARE-PARE', region_id:9 },
  { id:57, city:'TERNATE', region_id:9 },
  // R11 Maluku Papua
  { id:58, city:'AMBON', region_id:11 }, { id:59, city:'JAYAPURA', region_id:11 },
  { id:60, city:'SORONG', region_id:11 }, { id:61, city:'TIMIKA', region_id:11 },
]

export async function GET() {
  return NextResponse.json({ cities: NOP_CITIES })
}
