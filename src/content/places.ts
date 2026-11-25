/**
 * YER ADLARI — topluluğun ad koyabildiği her yerin haritacı adı.
 *
 * Bir takipçi ad koyunca (world.json → namedPlaces) haritada o ad ve "adını koyan @…" görünür.
 * Ad konmamış yerler bu adla ve "adını sen koy" çağrısıyla görünür; yabani adalar "Adsız ada" yazar.
 */
import type { PlaceId } from "../types";

export const PLACE_NAMES: Readonly<Record<PlaceId, string>> = {
  fener: "Akınburnu Feneri",
  ruzgar_gulleri: "Rüzgâr Gülleri",
  iskele: "Liman İskelesi",
  senlik_ocagi: "Şenlik Ocağı",
  gunozu_tapinagi: "Günözü Tapınağı",
  pusluada_kemerleri: "Pusluada Kemerleri",
  kadim_kemer: "Kadim Kemer",
  akinburnu_obasi: "Akınburnu obası",
  suzulkoy_obasi: "Süzülkoy obası",
  pusluada_obasi: "Pusluada obası",
  burun_obasi: "Burun obası",
  yel_obasi: "Yel obası",
  agci_obasi: "Ağcılar obası",
  koybasi_obasi: "Koybaşı obası",
  gecit_obasi: "Geçit obası",
  yanki_obasi: "Yankı obası",
  kiragi_obasi: "Kırağı obası",
  yayla_obasi: "Yayla obası",
  kemer_obasi: "Kemeraltı obası",
  tapinak_obasi: "Tapınak obası",
  konuk_obasi: "Konuk obası",
  kut_kapisi: "Kut Kapısı",
  bati_kemer: "Batı Kemeri",
  ata_heykeli: "Ata Heykeli",
  balbal_yolu: "Balbal Yolu",
  yazitli_taslar: "Yazıtlı Taşlar",
  kartal_aniti: "Kartal Anıtı",
  dilek_agaci: "Dilek Ağacı",
  uckardes_feneri: "Üçkardeş Feneri",
  batik_gemi: "Batık Gemi",
  donmus_selale: "Donmuş Şelale",
  yikik_kale: "Yıkık Kale",
  ulu_kayin: "Ulu Kayın",
  firtina_feneri: "Fırtına Feneri",
  kartalyuva: "Adsız ada",
  buzultac: "Adsız ada",
  uckardes: "Adsız ada",
  yesilsirt: "Adsız ada",
  marti_adaciklari: "Adsız ada",
  kalekaya: "Adsız ada",
  kuzgunorman: "Adsız ada",
  firtinaburnu: "Adsız ada",
};
