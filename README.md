# Breadboard

Recopier un montage électronique dans le navigateur, pour apprendre et diagnostiquer.

- **Session** = un identifiant aléatoire dans l'URL (`/s/<uuid>`). Pas de compte : qui a le lien peut lire et modifier.
- **Magasin** → **boîte** de la session → **canevas** : on ajoute à sa boîte ce qu'on a chez soi (résistances, condensateurs, LED, diodes, boutons, fils Dupont, carte Makerfabs ESP32-S3 4G, câble jack), puis on glisse chaque pièce sur la breadboard.
- **Analyse** : courts-circuits d'alimentation, pièce dont les deux pattes sont reliées, deux pattes dans un trou, fil branché d'un seul côté, patte reliée à rien ; liste de ce qui est relié ensemble.
- **Versions** : instantanés nommés, comparaison (pièces ajoutées / déplacées / retirées et liaisons électriques gagnées / perdues), restauration.
- Clic droit sur une pièce ou un bloc : couleur des fils, valeur, sens, rotation (aussi touche `R`), ranger, supprimer.

## Travailler avec Claude

- **Copier pour Claude** (en haut) : copie un mode d'emploi complet (format JSON, comment ajouter une pièce « depuis le magasin », comment la placer, broches de la carte, calques) suivi du résumé et du JSON du montage. À coller dans n'importe quelle conversation.
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
Chacun se coche / décoche dans le panneau « Calques ».

```bash
curl -X PUT localhost:5173/api/sessions/<id>/layers/mesure-1 -H 'content-type: application/json' -d '{
  "name": "Mesure 1 · tension sur R2",
  "description": "Multimètre sur V⎓ 20 V. On attend ~1,65 V.",
  "items": [
    {"type": "probe", "port": "e25", "color": "rouge", "label": "rouge"},
    {"type": "probe", "port": "e24", "color": "noir",  "label": "noir"},
    {"type": "part",  "part": "R2", "color": "orange", "label": "à vérifier"},
    {"type": "line",  "from": "e21", "to": "-H20", "color": "bleu", "label": "fil manquant ?"},
    {"type": "note",  "port": "IO9", "text": "doit lire ~2180"}
  ]
}'
```

Ports : trous (`e25`, `+H7`, `-B30`), broches de la carte par nom (`IO9`, `GND`, `3V3`), fils du jack (`EAR_P`, `mic 1`…).
Couleurs : `rouge`, `noir`, `orange`, `bleu`, `vert`, `jaune`, `violet`, `blanc`, `rose`, `gris` ou hexadécimal.
