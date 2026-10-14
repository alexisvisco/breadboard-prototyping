# Breadboard

Recopier un montage électronique dans le navigateur, pour apprendre et diagnostiquer.

- **Session** = un identifiant aléatoire dans l'URL (`/s/<uuid>`). Pas de compte : qui a le lien peut lire et modifier.
- **Magasin** → **boîte** de la session → **canevas** : on ajoute à sa boîte ce qu'on a chez soi, puis on glisse chaque pièce sur une planche. Trois rayons :
  - **Composants** : résistances, potentiomètre, photorésistance, thermistance, condensateurs, bobine, LED (et LED RGB), diodes (Zener, Schottky), transistors NPN / PNP, MOSFET, régulateur 7805, bouton, interrupteur, buzzer, moteur, servo, HC-SR04, piles, fils Dupont. Les pièces à 3 ou 4 pattes se posent côte à côte et leurs pattes sont nommées sur le canevas (B · C · E, IN · GND · OUT…).
  - **Planches** : breadboards sur mesure (nombre de colonnes, rails + − en option ; presets 170 / 400 / 830 points) et plaques perforées sur mesure (perfboard à pastilles isolées, ou stripboard à bandes). On peut en ajouter autant qu'on veut.
  - **Cartes** : Makerfabs ESP32-S3 4G, câble jack, et des cartes de développement : ESP32 DevKit V1, ESP32-S3-DevKitC-1, ESP32-C3 SuperMini, ESP32-CAM, ESP8266 NodeMCU, Wemos D1 Mini, Raspberry Pi Pico, Arduino Nano. Leurs broches se relient avec des fils ; l'analyse repère 3V3 / 5V / GND court-circuités et une broche 3,3 V qui reçoit du 5 V.
- **Analyse** : courts-circuits d'alimentation, pièce dont les deux pattes sont reliées, deux pattes dans un trou, fil branché d'un seul côté, patte reliée à rien ; liste de ce qui est relié ensemble.
- **Diff** : choisis une version, tout ce qui a changé depuis s'affiche d'un coup sur le canevas (vert ajouté, orange déplacé / modifié, rouge retiré) ; la version d'avant reste visible en transparence à son ancienne place.
- **Versions** : instantanés nommés, comparaison (pièces ajoutées / déplacées / retirées et liaisons électriques gagnées / perdues), restauration.
- **Fils courbes** : sélectionne un fil, glisse le losange jaune au milieu pour le courber (double-clic : retour au pendant naturel) ; clic droit → « Courber le fil ». Dans le JSON, `"bend"` (px, + = côté droit de a vers b) : Claude peut s'en servir pour éviter que les fils se croisent.
- Clic droit sur une pièce ou un bloc : couleur des fils, valeur, sens, rotation (aussi touche `R`), ranger, supprimer.

## Travailler avec Claude

- **Copier pour Claude** (en haut) : copie un mode d'emploi complet (format JSON, comment ajouter une pièce « depuis le magasin », comment la placer, planches et cartes ajoutées avec leurs broches, calques) suivi du résumé et du JSON du montage. À coller dans n'importe quelle conversation.
- **Importer un JSON** : on colle la réponse de Claude (`{"name", "session", "layers"}`, avec ou sans bloc \`\`\`json). L'app vérifie (trous et broches existants, pattes cohérentes), montre le diff, puis crée une version — appliquée ou non.
- Avec accès réseau, Claude peut aussi passer par l'API (`POST …/versions`, `PUT …/layers/:id`).

## Lancer

```bash
npm install
npm run dev          # http://localhost:5173 (API incluse)
```

Production :

```bash
npm run build
npm start            # node server/index.ts → http://localhost:3000
```

Variables : `PORT`, `HOST`, `BREADBOARD_DB` (fichier SQLite, défaut `breadboard.db`) ou `DATABASE_URL=postgres://…` pour Postgres.
Node ≥ 22.18 (exécute le TypeScript du serveur directement et fournit `node:sqlite`).

Docker :

```bash
docker build -t breadboard .
docker run -p 3000:3000 -v breadboard-data:/data breadboard
```

## API

| Méthode | Route | |
|---|---|---|
| GET / PUT | `/api/sessions/:id` | session (JSON) ; PUT `{session, summary}` crée ou remplace |
| GET | `/api/sessions/:id/summary` | résumé texte du montage (pour Claude) |
| GET / POST | `/api/sessions/:id/versions` | liste ; POST `{name, session, summary}` |
| GET / DELETE | `/api/sessions/:id/versions/:vid` | une version |
| GET | `/api/sessions/:id/versions/:vid/summary` | résumé texte d'une version |
| GET | `/api/sessions/:id/layers` | calques d'annotation |
| PUT / DELETE | `/api/sessions/:id/layers/:layerId` | crée / remplace / supprime un calque |

## Calques d'annotation

Stockés à part de la session (l'enregistrement automatique du navigateur ne les écrase pas), relus par l'app toutes les 3 s.
Chacun se coche / décoche dans le panneau « Calques ». Cocher un calque le met en **focus** : le reste du montage est grisé, la vue cadre la mesure, la colonne de chaque trou visé est surlignée et son nom écrit en gros. Les `steps` s'affichent en liste numérotée, avec un bouton 👁 par trou.

```bash
curl -X PUT localhost:5173/api/sessions/<id>/layers/mesure-1 -H 'content-type: application/json' -d '{
  "name": "Mesure 1 · tension sur R2",
  "steps": ["Carte branchée, multimètre sur V⎓ 20 V", {"text": "Pointe rouge", "port": "e25"}, {"text": "Pointe noire", "port": "e24"}],
  "description": "On attend ~1,65 V (texte replié sous « Pourquoi ? »).",
  "items": [
    {"type": "probe", "port": "e25", "color": "rouge", "label": "rouge"},
    {"type": "probe", "port": "e24", "color": "noir",  "label": "noir"},
    {"type": "part",  "part": "R2", "color": "orange", "label": "à vérifier"},
    {"type": "line",  "from": "e21", "to": "-H20", "color": "bleu", "label": "fil manquant ?"},
    {"type": "note",  "port": "IO9", "text": "doit lire ~2180"}
  ]
}'
```

Ports : trous (`e25`, rails par colonne `+H44`, `-B30`), broches de la carte par nom (`IO9`, `GND`, `3V3`), fils du jack (`EAR_P`, `mic 1`…).
Couleurs : `rouge`, `noir`, `orange`, `bleu`, `vert`, `jaune`, `violet`, `blanc`, `rose`, `gris` ou hexadécimal.

## Déploiement

En ligne sur https://breadboard.srv.alexisvis.co (Coolify, base Postgres). Chaque push sur `main` redéploie automatiquement (webhook GitHub → Coolify).
