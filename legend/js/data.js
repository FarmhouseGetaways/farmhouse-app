/* ==========================================================================
   Reference data — countries, continents, US states.

   Everything here is static and hand-kept so the site needs no API key, no
   build step and no network beyond the map tiles. Country rows are:

       [ISO-3166 alpha-2, name, continent, lat, lng, territory?]

   lat/lng is a rough centroid. It is only used to drop a pin when you add a
   country without picking a spot on the map, so a degree of slop is fine —
   click the map and it is replaced with the real coordinates.

   `territory` marks a place that is not a sovereign country (Puerto Rico,
   Greenland, Antarctica...). Those are visitable and count on the map, but
   they are left out of the "x of 195" denominator, which is computed from
   this table rather than hardcoded so the two can never disagree.
   ========================================================================== */

window.LEGEND = window.LEGEND || {};

LEGEND.CONTINENTS = [
  { code: "NA", name: "North America", glyph: "◤" },
  { code: "SA", name: "South America", glyph: "◣" },
  { code: "EU", name: "Europe",        glyph: "◆" },
  { code: "AF", name: "Africa",        glyph: "▲" },
  { code: "AS", name: "Asia",          glyph: "■" },
  { code: "OC", name: "Oceania",       glyph: "●" },
  { code: "AN", name: "Antarctica",    glyph: "❄" }
];

LEGEND.COUNTRY_ROWS = [
  /* --- Africa (54) ---------------------------------------------------- */
  ["DZ", "Algeria", "AF", 28.0, 1.6],
  ["AO", "Angola", "AF", -11.2, 17.9],
  ["BJ", "Benin", "AF", 9.3, 2.3],
  ["BW", "Botswana", "AF", -22.3, 24.7],
  ["BF", "Burkina Faso", "AF", 12.2, -1.6],
  ["BI", "Burundi", "AF", -3.4, 29.9],
  ["CV", "Cabo Verde", "AF", 16.0, -24.0],
  ["CM", "Cameroon", "AF", 7.4, 12.4],
  ["CF", "Central African Republic", "AF", 6.6, 20.9],
  ["TD", "Chad", "AF", 15.5, 18.7],
  ["KM", "Comoros", "AF", -11.6, 43.3],
  ["CG", "Congo", "AF", -0.2, 15.8],
  ["CD", "DR Congo", "AF", -4.0, 21.8],
  ["DJ", "Djibouti", "AF", 11.8, 42.6],
  ["EG", "Egypt", "AF", 26.8, 30.8],
  ["GQ", "Equatorial Guinea", "AF", 1.6, 10.3],
  ["ER", "Eritrea", "AF", 15.2, 39.8],
  ["SZ", "Eswatini", "AF", -26.5, 31.5],
  ["ET", "Ethiopia", "AF", 9.1, 40.5],
  ["GA", "Gabon", "AF", -0.8, 11.6],
  ["GM", "Gambia", "AF", 13.4, -15.3],
  ["GH", "Ghana", "AF", 7.9, -1.0],
  ["GN", "Guinea", "AF", 9.9, -9.7],
  ["GW", "Guinea-Bissau", "AF", 11.8, -15.2],
  ["CI", "Côte d'Ivoire", "AF", 7.5, -5.5],
  ["KE", "Kenya", "AF", 0.0, 37.9],
  ["LS", "Lesotho", "AF", -29.6, 28.2],
  ["LR", "Liberia", "AF", 6.4, -9.4],
  ["LY", "Libya", "AF", 26.3, 17.2],
  ["MG", "Madagascar", "AF", -18.8, 47.0],
  ["MW", "Malawi", "AF", -13.3, 34.3],
  ["ML", "Mali", "AF", 17.6, -4.0],
  ["MR", "Mauritania", "AF", 21.0, -10.9],
  ["MU", "Mauritius", "AF", -20.3, 57.6],
  ["MA", "Morocco", "AF", 31.8, -7.1],
  ["MZ", "Mozambique", "AF", -18.7, 35.5],
  ["NA", "Namibia", "AF", -22.6, 17.1],
  ["NE", "Niger", "AF", 17.6, 8.1],
  ["NG", "Nigeria", "AF", 9.1, 8.7],
  ["RW", "Rwanda", "AF", -1.9, 29.9],
  ["ST", "São Tomé and Príncipe", "AF", 0.2, 6.6],
  ["SN", "Senegal", "AF", 14.5, -14.5],
  ["SC", "Seychelles", "AF", -4.7, 55.5],
  ["SL", "Sierra Leone", "AF", 8.5, -11.8],
  ["SO", "Somalia", "AF", 5.2, 46.2],
  ["ZA", "South Africa", "AF", -30.6, 22.9],
  ["SS", "South Sudan", "AF", 7.9, 30.0],
  ["SD", "Sudan", "AF", 12.9, 30.2],
  ["TZ", "Tanzania", "AF", -6.4, 34.9],
  ["TG", "Togo", "AF", 8.6, 0.8],
  ["TN", "Tunisia", "AF", 33.9, 9.5],
  ["UG", "Uganda", "AF", 1.4, 32.3],
  ["ZM", "Zambia", "AF", -13.1, 27.8],
  ["ZW", "Zimbabwe", "AF", -19.0, 29.2],

  /* --- Asia (48, Palestine included) ---------------------------------- */
  ["AF", "Afghanistan", "AS", 33.9, 67.7],
  ["AM", "Armenia", "AS", 40.1, 45.0],
  ["AZ", "Azerbaijan", "AS", 40.1, 47.6],
  ["BH", "Bahrain", "AS", 26.0, 50.6],
  ["BD", "Bangladesh", "AS", 23.7, 90.4],
  ["BT", "Bhutan", "AS", 27.5, 90.4],
  ["BN", "Brunei", "AS", 4.5, 114.7],
  ["KH", "Cambodia", "AS", 12.6, 105.0],
  ["CN", "China", "AS", 35.9, 104.2],
  ["CY", "Cyprus", "AS", 35.1, 33.4],
  ["GE", "Georgia", "AS", 42.3, 43.4],
  ["IN", "India", "AS", 20.6, 79.0],
  ["ID", "Indonesia", "AS", -0.8, 113.9],
  ["IR", "Iran", "AS", 32.4, 53.7],
  ["IQ", "Iraq", "AS", 33.2, 43.7],
  ["IL", "Israel", "AS", 31.0, 34.9],
  ["JP", "Japan", "AS", 36.2, 138.3],
  ["JO", "Jordan", "AS", 30.6, 36.2],
  ["KZ", "Kazakhstan", "AS", 48.0, 66.9],
  ["KW", "Kuwait", "AS", 29.3, 47.5],
  ["KG", "Kyrgyzstan", "AS", 41.2, 74.8],
  ["LA", "Laos", "AS", 19.9, 102.5],
  ["LB", "Lebanon", "AS", 33.9, 35.9],
  ["MY", "Malaysia", "AS", 4.2, 102.0],
  ["MV", "Maldives", "AS", 3.2, 73.2],
  ["MN", "Mongolia", "AS", 46.9, 103.8],
  ["MM", "Myanmar", "AS", 21.9, 96.0],
  ["NP", "Nepal", "AS", 28.4, 84.1],
  ["KP", "North Korea", "AS", 40.3, 127.5],
  ["OM", "Oman", "AS", 21.5, 55.9],
  ["PK", "Pakistan", "AS", 30.4, 69.3],
  ["PS", "Palestine", "AS", 31.9, 35.2],
  ["PH", "Philippines", "AS", 12.9, 121.8],
  ["QA", "Qatar", "AS", 25.4, 51.2],
  ["SA", "Saudi Arabia", "AS", 23.9, 45.1],
  ["SG", "Singapore", "AS", 1.35, 103.8],
  ["KR", "South Korea", "AS", 35.9, 127.8],
  ["LK", "Sri Lanka", "AS", 7.9, 80.8],
  ["SY", "Syria", "AS", 34.8, 39.0],
  ["TJ", "Tajikistan", "AS", 38.9, 71.3],
  ["TH", "Thailand", "AS", 15.9, 101.0],
  ["TL", "Timor-Leste", "AS", -8.9, 125.7],
  ["TR", "Türkiye", "AS", 39.0, 35.2],
  ["TM", "Turkmenistan", "AS", 39.0, 59.6],
  ["AE", "United Arab Emirates", "AS", 23.4, 53.8],
  ["UZ", "Uzbekistan", "AS", 41.4, 64.6],
  ["VN", "Vietnam", "AS", 14.1, 108.3],
  ["YE", "Yemen", "AS", 15.6, 48.5],

  /* --- Europe (44, Vatican included) ---------------------------------- */
  ["AL", "Albania", "EU", 41.2, 20.2],
  ["AD", "Andorra", "EU", 42.5, 1.6],
  ["AT", "Austria", "EU", 47.5, 14.6],
  ["BY", "Belarus", "EU", 53.7, 28.0],
  ["BE", "Belgium", "EU", 50.5, 4.5],
  ["BA", "Bosnia and Herzegovina", "EU", 43.9, 17.7],
  ["BG", "Bulgaria", "EU", 42.7, 25.5],
  ["HR", "Croatia", "EU", 45.1, 15.2],
  ["CZ", "Czechia", "EU", 49.8, 15.5],
  ["DK", "Denmark", "EU", 56.3, 9.5],
  ["EE", "Estonia", "EU", 58.6, 25.0],
  ["FI", "Finland", "EU", 61.9, 25.7],
  ["FR", "France", "EU", 46.2, 2.2],
  ["DE", "Germany", "EU", 51.2, 10.45],
  ["GR", "Greece", "EU", 39.1, 21.8],
  ["HU", "Hungary", "EU", 47.2, 19.5],
  ["IS", "Iceland", "EU", 65.0, -19.0],
  ["IE", "Ireland", "EU", 53.4, -8.2],
  ["IT", "Italy", "EU", 41.9, 12.6],
  ["LV", "Latvia", "EU", 56.9, 24.6],
  ["LI", "Liechtenstein", "EU", 47.2, 9.6],
  ["LT", "Lithuania", "EU", 55.2, 23.9],
  ["LU", "Luxembourg", "EU", 49.8, 6.1],
  ["MT", "Malta", "EU", 35.9, 14.4],
  ["MD", "Moldova", "EU", 47.4, 28.4],
  ["MC", "Monaco", "EU", 43.75, 7.4],
  ["ME", "Montenegro", "EU", 42.7, 19.4],
  ["NL", "Netherlands", "EU", 52.1, 5.3],
  ["MK", "North Macedonia", "EU", 41.6, 21.7],
  ["NO", "Norway", "EU", 60.5, 8.5],
  ["PL", "Poland", "EU", 51.9, 19.1],
  ["PT", "Portugal", "EU", 39.4, -8.2],
  ["RO", "Romania", "EU", 45.9, 25.0],
  ["RU", "Russia", "EU", 61.5, 105.3],
  ["SM", "San Marino", "EU", 43.9, 12.5],
  ["RS", "Serbia", "EU", 44.0, 21.0],
  ["SK", "Slovakia", "EU", 48.7, 19.7],
  ["SI", "Slovenia", "EU", 46.15, 15.0],
  ["ES", "Spain", "EU", 40.5, -3.7],
  ["SE", "Sweden", "EU", 60.1, 18.6],
  ["CH", "Switzerland", "EU", 46.8, 8.2],
  ["UA", "Ukraine", "EU", 48.4, 31.2],
  ["GB", "United Kingdom", "EU", 55.4, -3.4],
  ["VA", "Vatican City", "EU", 41.9, 12.45],

  /* --- North America (23) --------------------------------------------- */
  ["AG", "Antigua and Barbuda", "NA", 17.1, -61.8],
  ["BS", "Bahamas", "NA", 25.0, -77.4],
  ["BB", "Barbados", "NA", 13.2, -59.5],
  ["BZ", "Belize", "NA", 17.2, -88.5],
  ["CA", "Canada", "NA", 56.1, -106.3],
  ["CR", "Costa Rica", "NA", 9.7, -83.8],
  ["CU", "Cuba", "NA", 21.5, -77.8],
  ["DM", "Dominica", "NA", 15.4, -61.4],
  ["DO", "Dominican Republic", "NA", 18.7, -70.2],
  ["SV", "El Salvador", "NA", 13.8, -88.9],
  ["GD", "Grenada", "NA", 12.1, -61.7],
  ["GT", "Guatemala", "NA", 15.8, -90.2],
  ["HT", "Haiti", "NA", 19.0, -72.3],
  ["HN", "Honduras", "NA", 15.2, -86.2],
  ["JM", "Jamaica", "NA", 18.1, -77.3],
  ["MX", "Mexico", "NA", 23.6, -102.5],
  ["NI", "Nicaragua", "NA", 12.9, -85.2],
  ["PA", "Panama", "NA", 8.5, -80.8],
  ["KN", "Saint Kitts and Nevis", "NA", 17.36, -62.8],
  ["LC", "Saint Lucia", "NA", 13.9, -61.0],
  ["VC", "Saint Vincent and the Grenadines", "NA", 12.98, -61.3],
  ["TT", "Trinidad and Tobago", "NA", 10.7, -61.2],
  ["US", "United States", "NA", 39.8, -98.6],

  /* --- South America (12) --------------------------------------------- */
  ["AR", "Argentina", "SA", -38.4, -63.6],
  ["BO", "Bolivia", "SA", -16.3, -63.6],
  ["BR", "Brazil", "SA", -14.2, -51.9],
  ["CL", "Chile", "SA", -35.7, -71.5],
  ["CO", "Colombia", "SA", 4.6, -74.3],
  ["EC", "Ecuador", "SA", -1.8, -78.2],
  ["GY", "Guyana", "SA", 4.9, -58.9],
  ["PY", "Paraguay", "SA", -23.4, -58.4],
  ["PE", "Peru", "SA", -9.2, -75.0],
  ["SR", "Suriname", "SA", 3.9, -56.0],
  ["UY", "Uruguay", "SA", -32.5, -55.8],
  ["VE", "Venezuela", "SA", 6.4, -66.6],

  /* --- Oceania (14) ---------------------------------------------------- */
  ["AU", "Australia", "OC", -25.3, 133.8],
  ["FJ", "Fiji", "OC", -17.7, 178.1],
  ["KI", "Kiribati", "OC", -3.4, -168.7],
  ["MH", "Marshall Islands", "OC", 7.1, 171.2],
  ["FM", "Micronesia", "OC", 7.4, 150.6],
  ["NR", "Nauru", "OC", -0.5, 166.9],
  ["NZ", "New Zealand", "OC", -40.9, 174.9],
  ["PW", "Palau", "OC", 7.5, 134.6],
  ["PG", "Papua New Guinea", "OC", -6.3, 144.0],
  ["WS", "Samoa", "OC", -13.8, -172.1],
  ["SB", "Solomon Islands", "OC", -9.6, 160.2],
  ["TO", "Tonga", "OC", -21.2, -175.2],
  ["TV", "Tuvalu", "OC", -7.1, 177.6],
  ["VU", "Vanuatu", "OC", -15.4, 167.0],

  /* --- Territories and dependencies (not counted toward the 195) ------- */
  ["AQ", "Antarctica", "AN", -75.0, 0.0, 1],
  ["AW", "Aruba", "NA", 12.5, -69.97, 1],
  ["BM", "Bermuda", "NA", 32.3, -64.75, 1],
  ["KY", "Cayman Islands", "NA", 19.3, -81.2, 1],
  ["GL", "Greenland", "NA", 71.7, -42.6, 1],
  ["GU", "Guam", "OC", 13.44, 144.8, 1],
  ["HK", "Hong Kong", "AS", 22.3, 114.2, 1],
  ["PF", "French Polynesia", "OC", -17.7, -149.4, 1],
  ["NC", "New Caledonia", "OC", -20.9, 165.6, 1],
  ["PR", "Puerto Rico", "NA", 18.2, -66.5, 1],
  ["TW", "Taiwan", "AS", 23.7, 121.0, 1],
  ["TC", "Turks and Caicos Islands", "NA", 21.7, -71.8, 1],
  ["VI", "U.S. Virgin Islands", "NA", 18.34, -64.9, 1],
  ["XK", "Kosovo", "EU", 42.6, 20.9, 1]
];

LEGEND.COUNTRIES = LEGEND.COUNTRY_ROWS.map(function (r) {
  return {
    code: r[0], name: r[1], continent: r[2],
    lat: r[3], lng: r[4], territory: !!r[5]
  };
}).sort(function (a, b) { return a.name.localeCompare(b.name); });

LEGEND.COUNTRY_BY_CODE = {};
LEGEND.COUNTRIES.forEach(function (c) { LEGEND.COUNTRY_BY_CODE[c.code] = c; });

/* How many sovereign countries there are to collect. Computed, never typed,
   so editing the table above can't leave the denominator lying. */
LEGEND.COUNTRY_TOTAL = LEGEND.COUNTRIES.filter(function (c) {
  return !c.territory;
}).length;

/* --------------------------------------------------------------------------
   US states.

       [abbr, name, grid-row, grid-col, lat, lng]

   The grid is the standard "state tiles" cartogram — one equal square per
   state, laid out so the country is still recognisable. Every state gets the
   same visual weight, which is the point of a tracker: Rhode Island is as
   hard to get to as Texas.
   -------------------------------------------------------------------------- */
LEGEND.STATE_ROWS = [
  ["AK", "Alaska", 0, 0, 64.2, -149.5],
  ["ME", "Maine", 0, 10, 45.3, -69.2],
  ["VT", "Vermont", 1, 9, 44.0, -72.7],
  ["NH", "New Hampshire", 1, 10, 43.2, -71.6],
  ["WA", "Washington", 2, 0, 47.4, -120.7],
  ["ID", "Idaho", 2, 1, 44.1, -114.7],
  ["MT", "Montana", 2, 2, 46.9, -110.4],
  ["ND", "North Dakota", 2, 3, 47.5, -100.5],
  ["MN", "Minnesota", 2, 4, 46.3, -94.3],
  ["IL", "Illinois", 2, 5, 40.0, -89.2],
  ["WI", "Wisconsin", 2, 6, 44.5, -89.6],
  ["MI", "Michigan", 2, 7, 44.3, -85.4],
  ["NY", "New York", 2, 8, 42.9, -75.5],
  ["RI", "Rhode Island", 2, 9, 41.7, -71.5],
  ["MA", "Massachusetts", 2, 10, 42.3, -71.8],
  ["OR", "Oregon", 3, 0, 43.8, -120.6],
  ["NV", "Nevada", 3, 1, 39.3, -116.6],
  ["WY", "Wyoming", 3, 2, 43.1, -107.6],
  ["SD", "South Dakota", 3, 3, 44.4, -100.2],
  ["IA", "Iowa", 3, 4, 42.0, -93.5],
  ["IN", "Indiana", 3, 5, 39.9, -86.3],
  ["OH", "Ohio", 3, 6, 40.4, -82.8],
  ["PA", "Pennsylvania", 3, 7, 40.9, -77.6],
  ["NJ", "New Jersey", 3, 8, 40.1, -74.7],
  ["CT", "Connecticut", 3, 9, 41.6, -72.7],
  ["CA", "California", 4, 0, 37.2, -119.5],
  ["UT", "Utah", 4, 1, 39.3, -111.7],
  ["CO", "Colorado", 4, 2, 39.0, -105.5],
  ["NE", "Nebraska", 4, 3, 41.5, -99.8],
  ["MO", "Missouri", 4, 4, 38.4, -92.5],
  ["KY", "Kentucky", 4, 5, 37.5, -85.3],
  ["WV", "West Virginia", 4, 6, 38.6, -80.6],
  ["VA", "Virginia", 4, 7, 37.5, -78.8],
  ["MD", "Maryland", 4, 8, 39.0, -76.8],
  ["DE", "Delaware", 4, 9, 39.0, -75.5],
  ["AZ", "Arizona", 5, 1, 34.2, -111.7],
  ["NM", "New Mexico", 5, 2, 34.4, -106.1],
  ["KS", "Kansas", 5, 3, 38.5, -98.4],
  ["AR", "Arkansas", 5, 4, 34.8, -92.4],
  ["TN", "Tennessee", 5, 5, 35.8, -86.4],
  ["NC", "North Carolina", 5, 6, 35.5, -79.4],
  ["SC", "South Carolina", 5, 7, 33.9, -80.9],
  ["DC", "District of Columbia", 5, 8, 38.9, -77.0],
  ["OK", "Oklahoma", 6, 3, 35.6, -97.5],
  ["LA", "Louisiana", 6, 4, 31.1, -92.0],
  ["MS", "Mississippi", 6, 5, 32.7, -89.7],
  ["AL", "Alabama", 6, 6, 32.8, -86.8],
  ["GA", "Georgia", 6, 7, 32.7, -83.4],
  ["HI", "Hawaii", 7, 0, 20.8, -156.3],
  ["TX", "Texas", 7, 3, 31.4, -99.3],
  ["FL", "Florida", 7, 8, 28.1, -81.7]
];

LEGEND.STATES = LEGEND.STATE_ROWS.map(function (r) {
  return { code: r[0], name: r[1], row: r[2], col: r[3], lat: r[4], lng: r[5] };
});

LEGEND.STATE_BY_CODE = {};
LEGEND.STATES.forEach(function (s) { LEGEND.STATE_BY_CODE[s.code] = s; });

/* Reverse lookup by full name, lower-cased — a geocoder hands back "Utah",
   not "UT". */
LEGEND.STATE_BY_NAME = {};
LEGEND.STATES.forEach(function (s) { LEGEND.STATE_BY_NAME[s.name.toLowerCase()] = s; });

/* DC is tracked and shown, but "50 states" means fifty. */
LEGEND.STATE_TOTAL = LEGEND.STATES.filter(function (s) {
  return s.code !== "DC";
}).length;

/* --------------------------------------------------------------------------
   Beyond Earth. "And beyond" gets its own scoreboard: the places that are
   not on any continent. Add a place with kind = "beyond" and give it one of
   these realms and it lands here instead of the country grid.
   -------------------------------------------------------------------------- */
LEGEND.REALMS = [
  { code: "sky",    name: "The Sky",        note: "Flight, jump, balloon — anything with air under it." },
  { code: "sea",    name: "Under the Sea",  note: "Dives, wrecks, reefs, submersibles." },
  { code: "summit", name: "Summits",        note: "Peaks stood on top of." },
  { code: "space",  name: "Space",          note: "The Kármán line and everything past it." }
];
