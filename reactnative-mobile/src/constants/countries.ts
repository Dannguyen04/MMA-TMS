export type Country = {
  code: string;
  name: string;
  callingCode: string;
  flag: string;
};

// ISO 3166-1 alpha-2, Vietnamese short name, ITU calling code (NANP members include area code).
const COUNTRY_ROWS: readonly (readonly [string, string, string])[] = [
  ["AD", "Andorra", "376"],
  ["AE", "Các Tiểu vương quốc Ả Rập Thống nhất", "971"],
  ["AF", "Afghanistan", "93"],
  ["AG", "Antigua và Barbuda", "1268"],
  ["AI", "Anguilla", "1264"],
  ["AL", "Albania", "355"],
  ["AM", "Armenia", "374"],
  ["AO", "Angola", "244"],
  ["AQ", "Nam Cực", "672"],
  ["AR", "Argentina", "54"],
  ["AS", "Samoa thuộc Mỹ", "1684"],
  ["AT", "Áo", "43"],
  ["AU", "Úc", "61"],
  ["AW", "Aruba", "297"],
  ["AX", "Quần đảo Åland", "358"],
  ["AZ", "Azerbaijan", "994"],
  ["BA", "Bosnia và Herzegovina", "387"],
  ["BB", "Barbados", "1246"],
  ["BD", "Bangladesh", "880"],
  ["BE", "Bỉ", "32"],
  ["BF", "Burkina Faso", "226"],
  ["BG", "Bulgaria", "359"],
  ["BH", "Bahrain", "973"],
  ["BI", "Burundi", "257"],
  ["BJ", "Bénin", "229"],
  ["BL", "Saint Barthélemy", "590"],
  ["BM", "Bermuda", "1441"],
  ["BN", "Brunei", "673"],
  ["BO", "Bolivia", "591"],
  ["BQ", "Ca-ri-bê Hà Lan", "599"],
  ["BR", "Brazil", "55"],
  ["BS", "Bahamas", "1242"],
  ["BT", "Bhutan", "975"],
  ["BV", "Đảo Bouvet", "47"],
  ["BW", "Botswana", "267"],
  ["BY", "Belarus", "375"],
  ["BZ", "Belize", "501"],
  ["CA", "Canada", "1"],
  ["CC", "Quần đảo Cocos (Keeling)", "61"],
  ["CD", "Cộng hòa Dân chủ Congo", "243"],
  ["CF", "Cộng hòa Trung Phi", "236"],
  ["CG", "Cộng hòa Congo", "242"],
  ["CH", "Thụy Sĩ", "41"],
  ["CI", "Bờ Biển Ngà", "225"],
  ["CK", "Quần đảo Cook", "682"],
  ["CL", "Chile", "56"],
  ["CM", "Cameroon", "237"],
  ["CN", "Trung Quốc", "86"],
  ["CO", "Colombia", "57"],
  ["CR", "Costa Rica", "506"],
  ["CU", "Cuba", "53"],
  ["CV", "Cabo Verde", "238"],
  ["CW", "Curaçao", "599"],
  ["CX", "Đảo Christmas", "61"],
  ["CY", "Síp", "357"],
  ["CZ", "Séc", "420"],
  ["DE", "Đức", "49"],
  ["DJ", "Djibouti", "253"],
  ["DK", "Đan Mạch", "45"],
  ["DM", "Dominica", "1767"],
  ["DO", "Cộng hòa Dominica", "1809"],
  ["DZ", "Algérie", "213"],
  ["EC", "Ecuador", "593"],
  ["EE", "Estonia", "372"],
  ["EG", "Ai Cập", "20"],
  ["EH", "Tây Sahara", "212"],
  ["ER", "Eritrea", "291"],
  ["ES", "Tây Ban Nha", "34"],
  ["ET", "Ethiopia", "251"],
  ["FI", "Phần Lan", "358"],
  ["FJ", "Fiji", "679"],
  ["FK", "Quần đảo Falkland", "500"],
  ["FM", "Micronesia", "691"],
  ["FO", "Quần đảo Faroe", "298"],
  ["FR", "Pháp", "33"],
  ["GA", "Gabon", "241"],
  ["GB", "Vương quốc Anh", "44"],
  ["GD", "Grenada", "1473"],
  ["GE", "Gruzia", "995"],
  ["GF", "Guyane thuộc Pháp", "594"],
  ["GG", "Guernsey", "44"],
  ["GH", "Ghana", "233"],
  ["GI", "Gibraltar", "350"],
  ["GL", "Greenland", "299"],
  ["GM", "Gambia", "220"],
  ["GN", "Guinée", "224"],
  ["GP", "Guadeloupe", "590"],
  ["GQ", "Guinea Xích Đạo", "240"],
  ["GR", "Hy Lạp", "30"],
  ["GS", "Nam Georgia và Quần đảo Nam Sandwich", "500"],
  ["GT", "Guatemala", "502"],
  ["GU", "Guam", "1671"],
  ["GW", "Guinea-Bissau", "245"],
  ["GY", "Guyana", "592"],
  ["HK", "Hồng Kông", "852"],
  ["HM", "Đảo Heard và Quần đảo McDonald", "672"],
  ["HN", "Honduras", "504"],
  ["HR", "Croatia", "385"],
  ["HT", "Haiti", "509"],
  ["HU", "Hungary", "36"],
  ["ID", "Indonesia", "62"],
  ["IE", "Ireland", "353"],
  ["IL", "Israel", "972"],
  ["IM", "Đảo Man", "44"],
  ["IN", "Ấn Độ", "91"],
  ["IO", "Lãnh thổ Ấn Độ Dương thuộc Anh", "246"],
  ["IQ", "Iraq", "964"],
  ["IR", "Iran", "98"],
  ["IS", "Iceland", "354"],
  ["IT", "Ý", "39"],
  ["JE", "Jersey", "44"],
  ["JM", "Jamaica", "1876"],
  ["JO", "Jordan", "962"],
  ["JP", "Nhật Bản", "81"],
  ["KE", "Kenya", "254"],
  ["KG", "Kyrgyzstan", "996"],
  ["KH", "Campuchia", "855"],
  ["KI", "Kiribati", "686"],
  ["KM", "Comoros", "269"],
  ["KN", "Saint Kitts và Nevis", "1869"],
  ["KP", "Triều Tiên", "850"],
  ["KR", "Hàn Quốc", "82"],
  ["KW", "Kuwait", "965"],
  ["KY", "Quần đảo Cayman", "1345"],
  ["KZ", "Kazakhstan", "7"],
  ["LA", "Lào", "856"],
  ["LB", "Liban", "961"],
  ["LC", "Saint Lucia", "1758"],
  ["LI", "Liechtenstein", "423"],
  ["LK", "Sri Lanka", "94"],
  ["LR", "Liberia", "231"],
  ["LS", "Lesotho", "266"],
  ["LT", "Litva", "370"],
  ["LU", "Luxembourg", "352"],
  ["LV", "Latvia", "371"],
  ["LY", "Libya", "218"],
  ["MA", "Maroc", "212"],
  ["MC", "Monaco", "377"],
  ["MD", "Moldova", "373"],
  ["ME", "Montenegro", "382"],
  ["MF", "Saint Martin (Pháp)", "590"],
  ["MG", "Madagascar", "261"],
  ["MH", "Quần đảo Marshall", "692"],
  ["MK", "Bắc Macedonia", "389"],
  ["ML", "Mali", "223"],
  ["MM", "Myanmar", "95"],
  ["MN", "Mông Cổ", "976"],
  ["MO", "Ma Cao", "853"],
  ["MP", "Quần đảo Bắc Mariana", "1670"],
  ["MQ", "Martinique", "596"],
  ["MR", "Mauritanie", "222"],
  ["MS", "Montserrat", "1664"],
  ["MT", "Malta", "356"],
  ["MU", "Mauritius", "230"],
  ["MV", "Maldives", "960"],
  ["MW", "Malawi", "265"],
  ["MX", "Mexico", "52"],
  ["MY", "Malaysia", "60"],
  ["MZ", "Mozambique", "258"],
  ["NA", "Namibia", "264"],
  ["NC", "New Caledonia", "687"],
  ["NE", "Niger", "227"],
  ["NF", "Đảo Norfolk", "672"],
  ["NG", "Nigeria", "234"],
  ["NI", "Nicaragua", "505"],
  ["NL", "Hà Lan", "31"],
  ["NO", "Na Uy", "47"],
  ["NP", "Nepal", "977"],
  ["NR", "Nauru", "674"],
  ["NU", "Niue", "683"],
  ["NZ", "New Zealand", "64"],
  ["OM", "Oman", "968"],
  ["PA", "Panama", "507"],
  ["PE", "Peru", "51"],
  ["PF", "Polynésie thuộc Pháp", "689"],
  ["PG", "Papua New Guinea", "675"],
  ["PH", "Philippines", "63"],
  ["PK", "Pakistan", "92"],
  ["PL", "Ba Lan", "48"],
  ["PM", "Saint Pierre và Miquelon", "508"],
  ["PN", "Quần đảo Pitcairn", "64"],
  ["PR", "Puerto Rico", "1787"],
  ["PS", "Palestine", "970"],
  ["PT", "Bồ Đào Nha", "351"],
  ["PW", "Palau", "680"],
  ["PY", "Paraguay", "595"],
  ["QA", "Qatar", "974"],
  ["RE", "Réunion", "262"],
  ["RO", "Romania", "40"],
  ["RS", "Serbia", "381"],
  ["RU", "Nga", "7"],
  ["RW", "Rwanda", "250"],
  ["SA", "Ả Rập Xê Út", "966"],
  ["SB", "Quần đảo Solomon", "677"],
  ["SC", "Seychelles", "248"],
  ["SD", "Sudan", "249"],
  ["SE", "Thụy Điển", "46"],
  ["SG", "Singapore", "65"],
  ["SH", "Saint Helena", "290"],
  ["SI", "Slovenia", "386"],
  ["SJ", "Svalbard và Jan Mayen", "47"],
  ["SK", "Slovakia", "421"],
  ["SL", "Sierra Leone", "232"],
  ["SM", "San Marino", "378"],
  ["SN", "Sénégal", "221"],
  ["SO", "Somalia", "252"],
  ["SR", "Suriname", "597"],
  ["SS", "Nam Sudan", "211"],
  ["ST", "São Tomé và Príncipe", "239"],
  ["SV", "El Salvador", "503"],
  ["SX", "Sint Maarten", "1721"],
  ["SY", "Syria", "963"],
  ["SZ", "Eswatini", "268"],
  ["TC", "Quần đảo Turks và Caicos", "1649"],
  ["TD", "Tchad", "235"],
  ["TF", "Lãnh thổ phía Nam thuộc Pháp", "262"],
  ["TG", "Togo", "228"],
  ["TH", "Thái Lan", "66"],
  ["TJ", "Tajikistan", "992"],
  ["TK", "Tokelau", "690"],
  ["TL", "Đông Timor", "670"],
  ["TM", "Turkmenistan", "993"],
  ["TN", "Tunisia", "216"],
  ["TO", "Tonga", "676"],
  ["TR", "Thổ Nhĩ Kỳ", "90"],
  ["TT", "Trinidad và Tobago", "1868"],
  ["TV", "Tuvalu", "688"],
  ["TW", "Đài Loan", "886"],
  ["TZ", "Tanzania", "255"],
  ["UA", "Ukraina", "380"],
  ["UG", "Uganda", "256"],
  ["UM", "Các đảo xa thuộc Hoa Kỳ", "1"],
  ["US", "Hoa Kỳ", "1"],
  ["UY", "Uruguay", "598"],
  ["UZ", "Uzbekistan", "998"],
  ["VA", "Thành Vatican", "39"],
  ["VC", "Saint Vincent và Grenadines", "1784"],
  ["VE", "Venezuela", "58"],
  ["VG", "Quần đảo Virgin thuộc Anh", "1284"],
  ["VI", "Quần đảo Virgin thuộc Mỹ", "1340"],
  ["VN", "Việt Nam", "84"],
  ["VU", "Vanuatu", "678"],
  ["WF", "Wallis và Futuna", "681"],
  ["WS", "Samoa", "685"],
  ["YE", "Yemen", "967"],
  ["YT", "Mayotte", "262"],
  ["ZA", "Nam Phi", "27"],
  ["ZM", "Zambia", "260"],
  ["ZW", "Zimbabwe", "263"],
];

// Italian-numbering-plan countries keep the leading 0 in international format.
const KEEPS_LEADING_ZERO = new Set(["IT", "SM", "VA"]);

/** E.164 caps a full number at 15 digits. */
export const MAX_PHONE_DIGITS = 15;

export const DEFAULT_COUNTRY_CODE = "VN";

function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

export const COUNTRIES: readonly Country[] = COUNTRY_ROWS.map(([code, name, callingCode]) => ({
  code,
  name,
  callingCode,
  flag: flagEmoji(code),
})).sort((a, b) => a.name.localeCompare(b.name, "vi"));

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export function findCountry(code: string): Country | undefined {
  return COUNTRY_BY_CODE.get(code.trim().toUpperCase());
}

export const DEFAULT_COUNTRY: Country = {
  code: DEFAULT_COUNTRY_CODE,
  name: "Việt Nam",
  callingCode: "84",
  flag: flagEmoji(DEFAULT_COUNTRY_CODE),
};

function foldSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

const SEARCH_INDEX = new Map(
  COUNTRIES.map((country) => [
    country.code,
    `${foldSearch(country.name)} ${country.code.toLowerCase()} +${country.callingCode}`,
  ]),
);

export function filterCountries(query: string): readonly Country[] {
  const needle = foldSearch(query);
  if (!needle) return COUNTRIES;
  return COUNTRIES.filter((country) => SEARCH_INDEX.get(country.code)?.includes(needle));
}

export function nationalDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS);
}

/** Builds the single E.164-style contactPhone string, or undefined when no digits were typed. */
export function toInternationalPhone(country: Country, national: string): string | undefined {
  const digits = nationalDigits(national);
  const significant = KEEPS_LEADING_ZERO.has(country.code) ? digits : digits.replace(/^0+/, "");
  return significant ? `+${country.callingCode}${significant}` : undefined;
}
