import { MapObstacle } from "./types";

export const MAP_OBSTACLES: MapObstacle[] = [
  // =========================
  // ZONE PAVILLONNAIRE NORD-OUEST
  // =========================
  { id: "house1", x: 140, y: 120, width: 180, height: 130, kind: "building", color: "#6b4f3d" },
  { id: "house2", x: 380, y: 120, width: 180, height: 130, kind: "building", color: "#75563f" },
  { id: "house3", x: 140, y: 320, width: 180, height: 130, kind: "building", color: "#5f4536" },
  { id: "house4", x: 380, y: 320, width: 180, height: 130, kind: "building", color: "#6a4d3c" },

  { id: "garden_tree1", x: 100, y: 90, width: 48, height: 48, kind: "tree", color: "#2f7d32" },
  { id: "garden_tree2", x: 330, y: 90, width: 48, height: 48, kind: "tree", color: "#2f7d32" },
  { id: "garden_tree3", x: 580, y: 180, width: 48, height: 48, kind: "tree", color: "#2f7d32" },
  { id: "garden_tree4", x: 580, y: 380, width: 48, height: 48, kind: "tree", color: "#2f7d32" },

  // =========================
  // ZONE PAVILLONNAIRE NORD-EST
  // =========================
  { id: "house5", x: 1710, y: 120, width: 180, height: 130, kind: "building", color: "#604636" },
  { id: "house6", x: 1950, y: 120, width: 180, height: 130, kind: "building", color: "#6d5141" },
  { id: "house7", x: 1710, y: 320, width: 180, height: 130, kind: "building", color: "#745642" },
  { id: "house8", x: 1950, y: 320, width: 180, height: 130, kind: "building", color: "#6b4f3d" },

  { id: "garden_tree5", x: 1660, y: 180, width: 48, height: 48, kind: "tree", color: "#2f7d32" },
  { id: "garden_tree6", x: 1900, y: 90, width: 48, height: 48, kind: "tree", color: "#2f7d32" },
  { id: "garden_tree7", x: 2140, y: 190, width: 48, height: 48, kind: "tree", color: "#2f7d32" },
  { id: "garden_tree8", x: 2140, y: 390, width: 48, height: 48, kind: "tree", color: "#2f7d32" },

  // =========================
  // PLACE DU VILLAGE (CENTRE)
  // =========================
  { id: "village_square", x: 820, y: 430, width: 620, height: 420, kind: "plaza", color: "#b9a27f" },

  // logo Bitcoin au centre de la place
  { id: "btc_logo_zone", x: 1085, y: 565, width: 90, height: 90, kind: "logo", color: "#f7931a" },

  // bancs autour de la place
  { id: "bench1", x: 930, y: 500, width: 72, height: 24, kind: "bench", color: "#7a522e" },
  { id: "bench2", x: 1260, y: 500, width: 72, height: 24, kind: "bench", color: "#7a522e" },
  { id: "bench3", x: 930, y: 740, width: 72, height: 24, kind: "bench", color: "#7a522e" },
  { id: "bench4", x: 1260, y: 740, width: 72, height: 24, kind: "bench", color: "#7a522e" },

  // arbres décoratifs autour de la place
  { id: "square_tree1", x: 770, y: 390, width: 52, height: 52, kind: "tree", color: "#2f7d32" },
  { id: "square_tree2", x: 1435, y: 390, width: 52, height: 52, kind: "tree", color: "#2f7d32" },
  { id: "square_tree3", x: 770, y: 860, width: 52, height: 52, kind: "tree", color: "#2f7d32" },
  { id: "square_tree4", x: 1435, y: 860, width: 52, height: 52, kind: "tree", color: "#2f7d32" },

  // =========================
  // PETIT ÉTANG / COIN DÉTENTE
  // =========================
  { id: "lake", x: 1520, y: 540, width: 260, height: 180, kind: "lake", color: "#225f86" },
  { id: "lake_tree1", x: 1480, y: 500, width: 52, height: 52, kind: "tree", color: "#2f7d32" },
  { id: "lake_tree2", x: 1780, y: 500, width: 52, height: 52, kind: "tree", color: "#2f7d32" },
  { id: "lake_tree3", x: 1480, y: 730, width: 52, height: 52, kind: "tree", color: "#2f7d32" },
  { id: "lake_tree4", x: 1780, y: 730, width: 52, height: 52, kind: "tree", color: "#2f7d32" },

  // =========================
  // QG DES CHAUFFAGISTES (SUD)
  // =========================
  { id: "hq_main", x: 860, y: 1040, width: 540, height: 260, kind: "building", color: "#4f3a2e" },

  // aile gauche / droite pour donner un style plus "campus / base"
  { id: "hq_left", x: 700, y: 1090, width: 130, height: 160, kind: "building", color: "#5b4636" },
  { id: "hq_right", x: 1430, y: 1090, width: 130, height: 160, kind: "building", color: "#5b4636" },

  // esplanade devant le QG
  { id: "hq_courtyard", x: 900, y: 910, width: 460, height: 90, kind: "plaza", color: "#a69272" },

  // logo des Chauffagistes devant le QG
  //{ id: "chauffagistes_logo_zone", x: 1115, y: 920, width: 80, height: 80, kind: "logo", color: "#d94f2b" },

  // arbres / déco autour du QG
  { id: "hq_tree1", x: 780, y: 980, width: 52, height: 52, kind: "tree", color: "#2f7d32" },
  { id: "hq_tree2", x: 1460, y: 980, width: 52, height: 52, kind: "tree", color: "#2f7d32" },
  { id: "hq_tree3", x: 780, y: 1260, width: 52, height: 52, kind: "tree", color: "#2f7d32" },
  { id: "hq_tree4", x: 1460, y: 1260, width: 52, height: 52, kind: "tree", color: "#2f7d32" },

  // mobilier urbain devant le QG
  { id: "hq_bench1", x: 970, y: 1010, width: 72, height: 24, kind: "bench", color: "#7a522e" },
  { id: "hq_bench2", x: 1220, y: 1010, width: 72, height: 24, kind: "bench", color: "#7a522e" },
];