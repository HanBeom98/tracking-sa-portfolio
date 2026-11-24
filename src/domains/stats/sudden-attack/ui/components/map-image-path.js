export function getMapImagePath(mapName = '') {
  const normalized = String(mapName)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()\[\]{}\-_]/g, '');
  const aliases = [
    [['a크로스포트'], '/stats/sudden-attack/assets/maps/3v3/a-crossport-simple.jpg'],
    [['b드래곤로드'], '/stats/sudden-attack/assets/maps/3v3/b-dragon-road-simple.jpg'],
    [['b프로방스'], '/stats/sudden-attack/assets/maps/3v3/b-provence-simple.jpg'],
    [['a보급창고'], '/stats/sudden-attack/assets/maps/3v3/a-supply-simple.jpg'],
    [['b2연구소'], '/stats/sudden-attack/assets/maps/5v5/b2-lab.jpg'],
    [['b2'], '/stats/sudden-attack/assets/maps/3v3/b2.jpg'],
    [['듀오릭'], '/stats/sudden-attack/assets/maps/5v5/duoric.jpg'],
    [['듀오'], '/stats/sudden-attack/assets/maps/3v3/duo-simple.jpg'],
    [['스카이라인'], '/stats/sudden-attack/assets/maps/3v3/skyline.jpg'],
    [['아머리'], '/stats/sudden-attack/assets/maps/3v3/armory.jpg'],
    [['트리오'], '/stats/sudden-attack/assets/maps/3v3/trio.jpg'],
    [['할렘'], '/stats/sudden-attack/assets/maps/3v3/harlem.jpg'],
    [['3보급', '제3보급'], 'third-supply-simple.jpg'],
    [['5보급', '제5보급'], 'fifth-supply-simple.jpg'],
    [['데저트'], 'desert.jpg'],
    [['드래곤로드'], 'dragon-road-simple.jpg'],
    [['마린베이스'], 'marine-base.jpg'],
    [['시티캣', '시티켓'], 'city-cat-simple.jpg'],
    [['올드타운'], 'old-town-simple.jpg'],
    [['지하철'], 'subway-simple.jpg'],
    [['크로스포트'], 'crossport-simple.jpg'],
    [['팰리스'], 'palace-simple.jpg'],
    [['프로방스'], 'provence-simple.jpg'],
    [['프로즌시티'], 'frozen-city.jpg'],
    [['해양중계소'], 'ocean-relay.jpg'],
    [['화이트스콜'], 'white-squall-simple.jpg'],
    [['이탈리아'], 'italy.jpg']
  ];
  const matched = aliases.find(([names]) => names.some((name) => normalized.includes(name)));
  if (!matched) return '';
  return matched[1].startsWith('/')
    ? matched[1]
    : `/stats/sudden-attack/assets/maps/5v5/${matched[1]}`;
}
