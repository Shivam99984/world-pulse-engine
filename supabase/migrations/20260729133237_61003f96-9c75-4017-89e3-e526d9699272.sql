DO $$
DECLARE
  country_rules text[][] := ARRAY[
    ARRAY['(u\.?s\.?a?|america|american|washington|biden|trump|white house)','United States'],
    ARRAY['(u\.?k\.?|britain|british|london|england|scotland)','United Kingdom'],
    ARRAY['(china|chinese|beijing|xi jinping|shanghai)','China'],
    ARRAY['(russia|russian|moscow|kremlin|putin)','Russia'],
    ARRAY['(ukraine|ukrainian|kyiv|zelensky)','Ukraine'],
    ARRAY['(india|indian|delhi|modi|mumbai)','India'],
    ARRAY['(japan|japanese|tokyo)','Japan'],
    ARRAY['(germany|german|berlin)','Germany'],
    ARRAY['(france|french|paris|macron)','France'],
    ARRAY['(israel|israeli|tel aviv|netanyahu|idf)','Israel'],
    ARRAY['(iran|iranian|tehran)','Iran'],
    ARRAY['(gaza|palestin|hamas|west bank)','Palestine'],
    ARRAY['(saudi|riyadh|mbs)','Saudi Arabia'],
    ARRAY['(turkey|turkish|ankara|erdogan)','Turkey'],
    ARRAY['(brazil|brazilian|brasilia|lula)','Brazil'],
    ARRAY['(mexico|mexican)','Mexico'],
    ARRAY['(canada|canadian|ottawa|trudeau)','Canada'],
    ARRAY['(australia|australian|sydney|canberra)','Australia'],
    ARRAY['(south korea|seoul|korean)','South Korea'],
    ARRAY['(north korea|pyongyang|kim jong)','North Korea'],
    ARRAY['(pakistan|islamabad)','Pakistan'],
    ARRAY['(taiwan|taipei)','Taiwan'],
    ARRAY['(nigeria|lagos|abuja)','Nigeria'],
    ARRAY['(south africa|johannesburg|cape town)','South Africa'],
    ARRAY['(egypt|cairo)','Egypt'],
    ARRAY['(spain|spanish|madrid)','Spain'],
    ARRAY['(italy|italian|rome)','Italy'],
    ARRAY['(argentina|buenos aires)','Argentina'],
    ARRAY['(venezuela|caracas|maduro)','Venezuela'],
    ARRAY['(afghanistan|kabul|taliban)','Afghanistan'],
    ARRAY['(syria|damascus|assad)','Syria'],
    ARRAY['(yemen|houthi)','Yemen'],
    ARRAY['(lebanon|beirut|hezbollah)','Lebanon'],
    ARRAY['(iraq|baghdad)','Iraq'],
    ARRAY['(eu|european union|brussels)','European Union']
  ];
  industry_rules text[][] := ARRAY[
    ARRAY['(ai|artificial intelligence|chatgpt|openai|anthropic|llm)','AI'],
    ARRAY['(bitcoin|crypto|ethereum|token|blockchain)','Crypto'],
    ARRAY['(bank|banking|finance|financial|hedge fund|wall street)','Finance'],
    ARRAY['(oil|gas|opec|petrol|refinery|energy|renewable|solar|wind)','Energy'],
    ARRAY['(gold|silver|copper|commodity|commodities|wheat|corn)','Commodities'],
    ARRAY['(defense|military|missile|weapon|nato|army|navy|air force)','Defense'],
    ARRAY['(tech|software|google|apple|microsoft|meta|amazon|nvidia|chip|semiconductor)','Technology'],
    ARRAY['(pharma|drug|vaccine|healthcare|hospital|medic)','Healthcare'],
    ARRAY['(auto|car|ev|tesla|ford|toyota|vehicle)','Automotive'],
    ARRAY['(airline|aviation|boeing|airbus|flight)','Aviation'],
    ARRAY['(retail|consumer|walmart)','Retail'],
    ARRAY['(real estate|housing|mortgage|property)','Real Estate'],
    ARRAY['(media|film|movie|hollywood|streaming|netflix|music)','Media'],
    ARRAY['(sport|football|soccer|nba|nfl|olympic|fifa)','Sports'],
    ARRAY['(climate|carbon|emission|environment)','Climate'],
    ARRAY['(space|nasa|spacex|rocket|satellite)','Space'],
    ARRAY['(shipping|trade|tariff|export|import|supply chain)','Trade'],
    ARRAY['(election|government|policy|parliament)','Politics']
  ];
  rule text[];
  rec record;
  found_countries text[];
  found_industries text[];
  text_blob text;
BEGIN
  FOR rec IN SELECT id, headline, summary FROM public.events
    WHERE (countries = '{}' OR countries IS NULL) OR (industries = '{}' OR industries IS NULL)
  LOOP
    text_blob := lower(coalesce(rec.headline,'') || ' ' || coalesce(rec.summary,''));
    found_countries := ARRAY[]::text[];
    found_industries := ARRAY[]::text[];

    FOREACH rule SLICE 1 IN ARRAY country_rules LOOP
      IF text_blob ~ rule[1] AND NOT (rule[2] = ANY(found_countries)) THEN
        found_countries := found_countries || rule[2];
      END IF;
      EXIT WHEN array_length(found_countries,1) >= 4;
    END LOOP;

    FOREACH rule SLICE 1 IN ARRAY industry_rules LOOP
      IF text_blob ~ rule[1] AND NOT (rule[2] = ANY(found_industries)) THEN
        found_industries := found_industries || rule[2];
      END IF;
      EXIT WHEN array_length(found_industries,1) >= 3;
    END LOOP;

    UPDATE public.events
      SET countries = CASE WHEN (countries = '{}' OR countries IS NULL) THEN found_countries ELSE countries END,
          industries = CASE WHEN (industries = '{}' OR industries IS NULL) THEN found_industries ELSE industries END
      WHERE id = rec.id;
  END LOOP;
END $$;