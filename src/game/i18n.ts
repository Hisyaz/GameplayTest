export type Language = 'en' | 'es';

export interface TranslationDictionary {
  // Scoreboard & Match Clock
  firstHalf: string;
  secondHalf: string;
  pause: string;
  resume: string;
  resetKickoff: string;
  resetToKickoff: string;
  matchPaused: string;
  controlsCheatSheet: string;
  movement: string;
  movePlayer: string;
  sprint: string;
  withBall: string;
  shortPass: string;
  longPass: string;
  shoot: string;
  cross: string;
  withoutBall: string;
  tackle: string;
  slide: string;
  clear: string;
  pushFoul: string;

  // Set Pieces
  freeKick: string;
  penalty: string;
  cornerKick: string;
  goalKick: string;
  throwIn: string;
  penaltyShootOnly: string;
  setPieceAimPrompt: string;
  throwInPrompt: string;
  cornerPrompt: string;

  // New Skills: E & Q
  eAutopass: string;
  eAutopassDesc: string;
  eStepOvers: string;
  eStepOversDesc: string;
  eRainbowFlick: string;
  eRainbowFlickDesc: string;
  qNutmegCruyff: string;
  qNutmegCruyffDesc: string;
  qShoulderHit: string;
  qShoulderHitDesc: string;
  eShirtPull: string;
  eShirtPullDesc: string;

  // Referee & Sight
  refereeSight: string;
  refereeSightDesc: string;
  refSawFoul: string;
  refMissedIt: string;
  yellowCard: string;
  redCard: string;
  foulWhistle: string;

  // Commentary Banners
  kickoffPlay: string;
  goalFor: string;
  goalCheer: string;
  autopassAhead: string;
  stepoversActive: string;
  stepoverCut: string;
  nutmegCheer: string;
  nutmegDash: string;
  cruyffTurnCheer: string;
  rainbowCheer: string;
  skillMoveExecuted: string;
  shoulderBargeSuccess: string;
  shirtPullFoul: string;
  shirtPullUnnoticed: string;
  illegalTackleOnStepover: string;
  penaltyAwarded: string;
  freekickAwarded: string;
  standingTackle: string;
  foulPush: string;

  // Ginga & Volleys Commentary & Guide
  gingaTitle: string;
  gingaDesc: string;
  volleysTitle: string;
  volleysDesc: string;
  gingaLift: string;
  gingaJuggle: string;
  gingaOverlift: string;
  sombreroOverDefender: string;
  sombreroFlick: string;
  bicycleKick: string;
  scissorKick: string;
  scorpionKick: string;
  crispVolley: string;
  flairVolleyPass: string;
  flairVolleyCross: string;
  volleyMiss: string;
  rusticVolleyClearance: string;
  headerAttempt: string;

  // Controls Bar
  autopassKey: string;
  stepoversKey: string;
  shieldKey: string;
  nutmegCruyffKey: string;
  shoulderBargeKey: string;
  shirtPullKey: string;
  gingaKey: string;
}

export const translations: Record<Language, TranslationDictionary> = {
  en: {
    firstHalf: '1ST HALF',
    secondHalf: '2ND HALF',
    pause: 'PAUSE',
    resume: 'RESUME',
    resetKickoff: 'RESET KICKOFF',
    resetToKickoff: 'RESET TO KICKOFF POSITIONS',
    matchPaused: 'MATCH PAUSED',
    controlsCheatSheet: 'CONTROLS & SKILLS GUIDE',
    movement: 'MOVEMENT',
    movePlayer: 'Move Player',
    sprint: 'Sprint / Run',
    withBall: 'WITH BALL (ATTACK)',
    shortPass: 'Pass (to feet)',
    longPass: 'Through Ball (to space)',
    shoot: 'Shoot (at goal)',
    cross: 'Cross (into box)',
    withoutBall: 'WITHOUT BALL (DEFEND)',
    tackle: 'Standing Tackle',
    slide: 'Sliding Tackle',
    clear: 'Clear Ball',
    pushFoul: 'Push / Foul',

    freeKick: 'FREE KICK',
    penalty: 'PENALTY KICK',
    cornerKick: 'CORNER KICK',
    goalKick: 'GOAL KICK',
    throwIn: 'THROW IN',
    penaltyShootOnly: 'PENALTY! POINT ARROWS & PRESS [A] TO SHOOT',
    setPieceAimPrompt: 'POINT ARROWS TO AIM • S: PASS | A: SHOOT | D: CROSS',
    throwInPrompt: 'POINT ARROWS TO AIM • S OR W: THROW IN',
    cornerPrompt: 'CORNER KICK • POINT ARROWS • D: CROSS | A: SHOOT | S: PASS',

    eAutopass: '[E] Long Autopass / Throw Ahead',
    eAutopassDesc: 'While running, hold E to charge a long autopass ahead. The longer you hold, the farther ahead it goes. Releases in the direction you point with arrows!',
    eStepOvers: 'Double-Tap [E] Step-Overs',
    eStepOversDesc: 'Double-tap E to do agile step-overs. Slows your run, but changing direction is hyper-effective. Defenders CANNOT tackle without committing a foul!',
    eRainbowFlick: 'Double-Tap [E] Rainbow Flick (Standing)',
    eRainbowFlickDesc: 'When stopped with a defender in front, double-tap E to flick the ball over their head and surge past!',
    qNutmegCruyff: 'Double-Tap [Q] Short Skills (Nutmeg / Cruyff)',
    qNutmegCruyffDesc: 'With the ball, tap Q twice: if a defender is behind you, spin and nutmeg them! If they are on your side, execute a sudden Cruyff turn!',
    qShoulderHit: '[Q] Shoulder Hit (Defense)',
    qShoulderHitDesc: 'Without the ball, pressing Q delivers a shoulder barge. Hitting from the side dislodges the player even if shielding!',
    eShirtPull: '[E] Shirt Pull (Defense)',
    eShirtPullDesc: 'Without the ball, tapping E pulls the opponent’s shirt to slow them down. If the referee sees it, it is a foul!',

    refereeSight: 'Referee Line of Sight',
    refereeSightDesc: 'The referee has a realistic vision cone (softly visible on pitch). They can only call fouls and penalties they actually see!',
    refSawFoul: 'FOUL! CALLED BY REFEREE',
    refMissedIt: 'TACTICAL FOUL (REF DIDN’T SEE IT)! PLAY ON!',
    yellowCard: 'YELLOW CARD!',
    redCard: 'RED CARD!',
    foulWhistle: 'FOUL!',

    kickoffPlay: 'KICK OFF - PLAY BALL!',
    goalFor: 'GOOOOOAL FOR',
    goalCheer: 'WHAT A GOAL!',
    autopassAhead: 'LONG AUTOPASS INTO SPACE!',
    stepoversActive: 'STEP-OVERS! AGILE DIRECTION SHIFT!',
    stepoverCut: 'STEP-OVER CUT PAST DEFENDER!',
    nutmegCheer: 'NUTMEG! INCREDIBLE TURN!',
    nutmegDash: 'NUTMEG SURGE PAST DEFENDER!',
    cruyffTurnCheer: 'CRUYFF TURN! DEFENDER LEFT STRANDED!',
    rainbowCheer: 'RAINBOW FLICK! SENSATIONAL SKILL!',
    skillMoveExecuted: 'SKILL MOVE EXECUTED!',
    shoulderBargeSuccess: 'POWERFUL SHOULDER BARGE! BALL WON!',
    shirtPullFoul: 'FOUL! SHIRT PULL SPOTTED BY REFEREE!',
    shirtPullUnnoticed: 'SHIRT PULL (REF MISSED IT)! SNEAKY TACTIC!',
    illegalTackleOnStepover: 'FOUL! ILLEGAL TACKLE ON STEP-OVER!',
    penaltyAwarded: 'PENALTY KICK AWARDED!',
    freekickAwarded: 'FREE KICK AWARDED!',
    standingTackle: 'STANDING TACKLE EXECUTED!',
    foulPush: 'PUSH FOUL COMMITTED!',

    gingaTitle: 'Ginga Juggling & Sombreros [SPACE]',
    gingaDesc: 'Hold SPACE to lift the ball. Hold duration controls height (tap again to keep juggling). Press arrows to throw & follow for a Sombrero over defenders! Hold >1.8s and you overlift out of control!',
    volleysTitle: 'Aerial Volleys & Flair Acrobatics',
    volleysDesc: 'Strike airborne balls before they touch turf! [A] Shoot | [S] Pass | [W] Long Pass | [D] Cross. Press [E] for a crisp driven volley, [Q] for flair: Bicycle Kick if high, Scissor Kick if low, Scorpion Kick if behind!',
    gingaLift: 'GINGA LIFT! TAP SPACE TO JUGGLE!',
    gingaJuggle: 'GINGA JUGGLE',
    gingaOverlift: 'GINGA OVERLIFT! LOST CONTROL OF BALL (>1.8s)!',
    sombreroOverDefender: 'SOMBRERO! FLICKED OVER DEFENDER!',
    sombreroFlick: 'SOMBRERO FLICK & SURGE!',
    bicycleKick: 'OVERHEAD BICYCLE KICK! SPECTACULAR! [Q]',
    scissorKick: 'SCISSOR KICK VOLLEY! [Q]',
    scorpionKick: 'SCORPION KICK! STUNNING FLICK! [Q]',
    crispVolley: 'CRISP DRIVEN SIDE-VOLLEY! [E]',
    flairVolleyPass: 'ACROBATIC FLICK PASS!',
    flairVolleyCross: 'SPECTACULAR VOLLEY CROSS!',
    volleyMiss: 'MISTIMED VOLLEY! HIT TURF TOO LATE!',
    rusticVolleyClearance: 'RUSTIC DEFENSIVE VOLLEY CLEARANCE!',
    headerAttempt: 'POWERFUL LEAPING HEADER!',

    autopassKey: 'Hold E: Long Autopass | 2x E: Step-Overs / Rainbow',
    stepoversKey: '2x E: Step-Overs',
    shieldKey: 'Hold Q: Shield Ball | 2x Q: Nutmeg / Cruyff',
    nutmegCruyffKey: '2x Q: Nutmeg / Cruyff',
    shoulderBargeKey: 'Q: Shoulder Barge',
    shirtPullKey: 'E: Shirt Pull (Ref watching!)',
    gingaKey: 'Space: Ginga Lift / Juggle / Sombrero | Q/E: Volley & Acrobatics',
  },
  es: {
    firstHalf: '1ER TIEMPO',
    secondHalf: '2DO TIEMPO',
    pause: 'PAUSA',
    resume: 'REANUDAR',
    resetKickoff: 'SAQUE INICIAL',
    resetToKickoff: 'VOLVER A POSICIONES DE SAQUE',
    matchPaused: 'PARTIDO EN PAUSA',
    controlsCheatSheet: 'GUÍA DE CONTROLES Y REGATES',
    movement: 'MOVIMIENTO',
    movePlayer: 'Mover Jugador',
    sprint: 'Correr / Sprint',
    withBall: 'CON BALÓN (ATAQUE)',
    shortPass: 'Pase al pie',
    longPass: 'Pase al hueco',
    shoot: 'Tiro a puerta',
    cross: 'Centro al área',
    withoutBall: 'SIN BALÓN (DEFENSA)',
    tackle: 'Entrada de pie',
    slide: 'Barrida / Segada',
    clear: 'Despejar balón',
    pushFoul: 'Empujar / Falta',

    freeKick: 'TIRO LIBRE',
    penalty: 'PENALTI',
    cornerKick: 'SAQUE DE ESQUINA',
    goalKick: 'SAQUE DE META',
    throwIn: 'SAQUE DE BANDA',
    penaltyShootOnly: '¡PENALTI! APUNTA CON FLECHAS Y PULSA [A] PARA DISPARAR',
    setPieceAimPrompt: 'APUNTA CON FLECHAS • S: PASE | A: TIRO | D: CENTRO',
    throwInPrompt: 'APUNTA CON FLECHAS • S O W: SACAR DE BANDA',
    cornerPrompt: 'CÓRNER • APUNTA CON FLECHAS • D: CENTRO | A: TIRO | S: PASE',

    eAutopass: '[E] Autopase Largo Adelantado',
    eAutopassDesc: 'Al correr, mantén pulsada la E para lanzar el balón más adelante. Cuanto más tiempo la mantengas, más lejos irá en la dirección que apuntes con las flechas.',
    eStepOvers: 'Doble Toque [E] Bicicletas (Paso por encima)',
    eStepOversDesc: 'Toca E dos veces para hacer bicicletas. Frenan tu carrera pero cambiar de dirección es muy efectivo. ¡Los defensas NO pueden quitarte el balón con entrada sin cometer falta!',
    eRainbowFlick: 'Doble Toque [E] Lambretta / Sombrerito (Parado)',
    eRainbowFlickDesc: 'Estando parado con un rival de frente, toca E dos veces para levantar el balón por encima de su cabeza y rebasarlo con clase.',
    qNutmegCruyff: 'Doble Toque [Q] Regates Cortos (Caño / Cruyff)',
    qNutmegCruyffDesc: 'Con balón, toca Q dos veces: si el defensa está detrás, giras y le haces un caño; si está a un lado, ejecutas un giro Cruyff.',
    qShoulderHit: '[Q] Golpe de Hombro (Defensa)',
    qShoulderHitDesc: 'Sin balón, pulsar Q da un golpe de hombro. Si entras de lado desestabilizas al rival incluso si está protegiendo el balón.',
    eShirtPull: '[E] Agarrón de Camiseta (Defensa)',
    eShirtPullDesc: 'Sin balón, pulsar E tira de la camiseta del rival para frenarlo. ¡Si el árbitro te ve, es falta!',

    refereeSight: 'Ángulo de Visión del Árbitro',
    refereeSightDesc: 'El árbitro cuenta con un cono de visión sutil en el césped. ¡Solo pitará las faltas que estén dentro de su campo visual!',
    refSawFoul: '¡FALTA SEÑALADA POR EL ÁRBITRO!',
    refMissedIt: '¡FALTA TÁCTICA (EL ÁRBITRO NO LO VIO)! ¡SIGA EL JUEGO!',
    yellowCard: '¡TARJETA AMARILLA!',
    redCard: '¡TARJETA ROJA!',
    foulWhistle: '¡FALTA!',

    kickoffPlay: '¡SAQUE INICIAL - COMIENZA EL PARTIDO!',
    goalFor: '¡GOLAAAAZO DE',
    goalCheer: '¡QUÉ GOLAZO!',
    autopassAhead: '¡AUTOPASE LARGO AL ESPACIO!',
    stepoversActive: '¡BICICLETAS! ¡CAMBIO DE RITMO Y DIRECCIÓN!',
    stepoverCut: '¡RECORTE CON BICICLETA DEJANDO ATRÁS AL DEFENSOR!',
    nutmegCheer: '¡CAÑO MAGISTRAL! ¡QUÉ REGATE!',
    nutmegDash: '¡ARRANCADA CON CAÑO INCLUIDO!',
    cruyffTurnCheer: '¡GIRO CRUYFF! ¡DEFENSA DESCOLOCADO!',
    rainbowCheer: '¡SOMBRERITO LAMBRETTA ESPECTACULAR!',
    skillMoveExecuted: '¡REGATE CON ÉXITO!',
    shoulderBargeSuccess: '¡CARGA LEGAL CON EL HOMBRO! ¡BALÓN RECUPERADO!',
    shirtPullFoul: '¡FALTA! ¡EL ÁRBITRO VIO EL AGARRÓN DE CAMISETA!',
    shirtPullUnnoticed: '¡AGARRÓN DE CAMISETA (NO VISTO POR EL ÁRBITRO)!',
    illegalTackleOnStepover: '¡FALTA! ¡ENTRADA ILEGAL ANTE BICICLETA!',
    penaltyAwarded: '¡PENALTI SEÑALADO!',
    freekickAwarded: '¡TIRO LIBRE SEÑALADO!',
    standingTackle: '¡ENTRADA LIMPIA REALIZADA!',
    foulPush: '¡FALTA POR EMPUJÓN!',

    gingaTitle: 'Sistema Ginga y Sombreritos [ESPACIO]',
    gingaDesc: 'Mantén ESPACIO para levantar el balón (toques/dominadas). Si mantienes flechas, lo lanzas y sigues para hacer sombreros a los defensas. Si superas 1.8 segundos, ¡el balón sale descontrolado!',
    volleysTitle: 'Voleas y Remates Acrobáticos',
    volleysDesc: '¡Golpea balones aéreos antes de que caigan! [A] Tiro | [S] Pase | [W] Pase largo | [D] Centro. Pulsa [E] para volea potente cruzada, [Q] para filigranas: Chilena si va alta, Tijera si va media, Escorpión si queda atrás.',
    gingaLift: '¡ELEVACIÓN GINGA! ¡TOCA ESPACIO PARA DOMINAR!',
    gingaJuggle: 'DOMINADAS GINGA',
    gingaOverlift: '¡EXCESO DE FUERZA GINGA! ¡BALÓN DESCONTROLADO (>1.8s)!',
    sombreroOverDefender: '¡SOMBRERITO ESPECTACULAR POR ENCIMA DEL DEFENSOR!',
    sombreroFlick: '¡SOMBRERITO Y ARRANCADA!',
    bicycleKick: '¡CHILENA ESPECTACULAR EN EL AIRE! [Q]',
    scissorKick: '¡TIJERA VOLADORA! [Q]',
    scorpionKick: '¡REMATE DEL ESCORPIÓN! ¡MAGIA PURA! [Q]',
    crispVolley: '¡VOLEA LIMPIA Y POTENTE! [E]',
    flairVolleyPass: '¡PASE DE VOLEA CON CLASE!',
    flairVolleyCross: '¡CENTRO DE VOLEA ACROBÁTICO!',
    volleyMiss: '¡VOLEA A DESTIEMPO! ¡EL BALÓN BOTÓ EN EL CÉSPED!',
    rusticVolleyClearance: '¡DESPEJE RÚSTICO DE VOLEA!',
    headerAttempt: '¡CABEZAZO IMPONENTE!',

    autopassKey: 'Mantén E: Autopase | 2x E: Bicicletas / Lambretta',
    stepoversKey: '2x E: Bicicletas',
    shieldKey: 'Mantén Q: Proteger Balón | 2x Q: Caño / Cruyff',
    nutmegCruyffKey: '2x Q: Caño / Cruyff',
    shoulderBargeKey: 'Q: Carga de hombro',
    shirtPullKey: 'E: Agarrar camiseta (¡Cuidado con el árbitro!)',
    gingaKey: 'Espacio: Ginga / Sombrerito | Q/E: Voleas y Chilenas',
  },
};

let currentLanguage: Language = 'en';

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(lang: Language) {
  currentLanguage = lang;
}

export function t<K extends keyof TranslationDictionary>(key: K): string {
  const dict = translations[currentLanguage] || translations.en;
  return dict[key] || translations.en[key] || key;
}
