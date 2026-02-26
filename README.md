# UCAC-ICAM — Systeme Multi-Agents IA

## Generation automatique de documents pedagogiques

**Prosit Aller (DOCX) · Prosit Retour (PPTX) · CER (DOCX)**

> Systeme intelligent base sur une architecture multi-agents (pattern ReAct) qui genere automatiquement les trois documents pedagogiques utilises dans la methode APP (Apprentissage Par Problemes) de l'UCAC-ICAM.

---

## Table des matieres

1. [Presentation du projet](#presentation-du-projet)
2. [Architecture technique](#architecture-technique)
3. [Technologies utilisees](#technologies-utilisees)
4. [Structure du projet](#structure-du-projet)
5. [Pre-requis](#pre-requis)
6. [Installation et demarrage](#installation-et-demarrage)
7. [Utilisation](#utilisation)
8. [API REST](#api-rest)
9. [Fonctionnement des agents](#fonctionnement-des-agents)
10. [Formats supportes](#formats-supportes)
11. [Auteur](#auteur)

---

## Presentation du projet

Ce projet est un systeme multi-agents IA concu pour automatiser la generation de documents pedagogiques dans le cadre de la methode APP (Apprentissage Par Problemes) utilisee a l'UCAC-ICAM.

A partir d'un simple theme/sujet, le systeme orchestre trois agents specialises qui produisent sequentiellement :

| # | Document | Format | Description |
|---|----------|--------|-------------|
| 1 | **Prosit Aller (PA)** | DOCX | Document initial : theme, mots-cles, contexte, besoin, problematique, contraintes, generalisation, pistes de solution, plan d'action |
| 2 | **Prosit Retour (PR)** | PPTX (12 slides) | Presentation de retour : definitions, rappel du contexte, besoins, contraintes, validation des hypotheses, plan d'action, solutions, synthese |
| 3 | **CER (Cahier d'Etude et de Recherche)** | DOCX | Cahier complet : contexte, objectifs d'apprentissage, objectifs de competences, besoins, problematique, contraintes, realisation, validation, conclusion, bibliographie |

Chaque agent utilise le **pattern ReAct** (Thought -> Action -> Observation) et partage une memoire commune pour assurer la coherence entre les documents.

---

## Architecture technique

```
                    +-------------------+
                    |   Interface React  |
                    |   (localhost:5173) |
                    +--------+----------+
                             |
                        API REST + SSE
                             |
                    +--------v----------+
                    |   Express Server   |
                    |   (localhost:3001) |
                    +--------+----------+
                             |
                    +--------v----------+
                    |   Orchestrateur    |
                    |  (memoire partagee)|
                    +--------+----------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v------+  +----v-------+
     |  Agent 1    |  |  Agent 2    |  |  Agent 3   |
     | Prosit Aller|  |Prosit Retour|  |    CER     |
     +------+------+  +------+------+  +-----+------+
            |                |               |
     +------v------+  +-----v-------+  +----v-------+
     | gen_docx_pa |  | gen_pptx_pr |  | gen_docx_cer|
     |   (.docx)   |  |   (.pptx)   |  |   (.docx)  |
     +-------------+  +-------------+  +-------------+
              |              |               |
              +--------------v---------------+
                      backend/output/
```

**Flux de donnees :**
1. L'utilisateur saisit un theme ou importe un fichier existant
2. Le serveur Express recoit la requete et lance l'orchestrateur
3. L'orchestrateur cree une memoire partagee et execute les agents sequentiellement
4. Chaque agent genere son contenu via l'API Google Gemini (LLM)
5. Les generateurs produisent les fichiers Office (DOCX/PPTX)
6. Les logs et la progression sont envoyes en temps reel via SSE (Server-Sent Events)
7. L'utilisateur telecharge les fichiers generes

---

## Technologies utilisees

### Backend

| Technologie | Version | Role |
|-------------|---------|------|
| **Node.js** | >= 18.0.0 | Runtime JavaScript |
| **Express.js** | 4.18.2 | Framework API REST |
| **Google Gemini API** | gemini-2.5-flash-lite | Moteur LLM pour la generation |
| **docx** | 9.5.1 | Generation de fichiers Word (.docx) |
| **pptxgenjs** | 4.0.1 | Generation de fichiers PowerPoint (.pptx) |
| **officeparser** | 6.0.4 | Extraction de texte depuis DOCX/PPTX/PDF |
| **dotenv** | 16.4.7 | Gestion des variables d'environnement |
| **cors** | 2.8.5 | Gestion du Cross-Origin |
| **nodemon** | 3.0.1 | Rechargement automatique en developpement |

### Frontend

| Technologie | Version | Role |
|-------------|---------|------|
| **React** | 18.2.0 | Framework UI |
| **Vite** | 5.0.8 | Bundler et serveur de developpement |

---

## Structure du projet

```
UCAC_App/
├── backend/
│   ├── server.js                     # API REST (Express) + streaming SSE
│   ├── orchestrator.js               # Coordinateur des 3 agents + memoire partagee
│   ├── llm.js                        # Interface Google Gemini API (retry automatique)
│   ├── parser.js                     # Extraction texte depuis DOCX/PPTX/PDF/JSON
│   ├── structurer.js                 # Structuration du texte brut en JSON via LLM
│   ├── parse_json.js                 # Parseur JSON robuste pour reponses LLM
│   ├── package.json
│   ├── .env.example                  # Template de configuration
│   ├── .env                          # Configuration locale (non versionne)
│   ├── agents/
│   │   ├── agent1_prosit_aller.js    # Agent 1 : generation du Prosit Aller
│   │   ├── agent2_prosit_retour.js   # Agent 2 : generation du Prosit Retour
│   │   └── agent3_cer.js             # Agent 3 : generation du CER
│   ├── generators/
│   │   ├── gen_docx_prosit_aller.js  # Generateur DOCX pour le Prosit Aller
│   │   ├── gen_pptx_prosit_retour.js # Generateur PPTX pour le Prosit Retour
│   │   └── gen_docx_cer.js           # Generateur DOCX pour le CER
│   ├── assets/
│   │   ├── logo_ucac.jpg             # Logo UCAC
│   │   └── logo_icam.jpg             # Logo ICAM
│   └── output/                       # Dossier des fichiers generes
│
├── frontend/
│   ├── index.html                    # Point d'entree HTML
│   ├── vite.config.js                # Configuration Vite + proxy API
│   ├── package.json
│   └── src/
│       ├── main.jsx                  # Point d'entree React
│       └── App.jsx                   # Composant principal (interface complete)
│
├── DEMARRER.sh                       # Script de demarrage automatique (Linux/Mac)
└── README.md                         # Ce fichier
```

---

## Pre-requis

- **Node.js** version 18.0.0 ou superieure ([telecharger](https://nodejs.org/))
- **npm** (inclus avec Node.js)
- **Cle API Google Gemini** gratuite ([obtenir ici](https://aistudio.google.com/apikey))

Pour verifier votre version de Node.js :

```bash
node --version
# Doit afficher v18.x.x ou superieur
```

---

## Installation et demarrage

### Methode 1 : Demarrage manuel (recommande)

#### Etape 1 — Cloner le projet

```bash
git clone <url-du-depot>
cd UCAC_App
```

#### Etape 2 — Configurer le backend

```bash
cd backend
npm install
```

Creer le fichier de configuration :

```bash
cp .env.example .env
```

Ouvrir le fichier `.env` et renseigner votre cle API Gemini :

```env
# Cle API Google Gemini — GRATUITE
# Obtenez la votre sur https://aistudio.google.com/apikey
GEMINI_API_KEY=votre_cle_api_ici

# Port du serveur (defaut : 3001)
PORT=3001
```

#### Etape 3 — Installer le frontend

```bash
cd ../frontend
npm install
```

#### Etape 4 — Lancer le backend

Dans un premier terminal :

```bash
cd backend
npm start
```

Le serveur demarre sur **http://localhost:3001**. Vous devriez voir :

```
Serveur pret sur http://localhost:3001
```

#### Etape 5 — Lancer le frontend

Dans un second terminal :

```bash
cd frontend
npm run dev
```

Le serveur de developpement demarre sur **http://localhost:5173**.

#### Etape 6 — Acceder a l'application

Ouvrir votre navigateur sur : **http://localhost:5173**

### Methode 2 : Script automatique (Linux/Mac)

```bash
chmod +x DEMARRER.sh
./DEMARRER.sh
```

Le script :
1. Verifie que Node.js 18+ est installe
2. Cree le `.env` a partir de `.env.example` si absent
3. Installe les dependances backend et frontend
4. Lance les deux serveurs simultanement

### Commandes utiles

| Commande | Repertoire | Description |
|----------|------------|-------------|
| `npm start` | `backend/` | Lancer le serveur en production |
| `npm run dev` | `backend/` | Lancer avec rechargement auto (nodemon) |
| `npm run dev` | `frontend/` | Lancer le serveur de dev Vite |
| `npm run build` | `frontend/` | Construire le frontend pour la production |
| `npm run preview` | `frontend/` | Previsualiser le build de production |
| `npm test` | `backend/` | Lancer un test avec un theme par defaut |

---

## Utilisation

### Mode 1 : Tout generer (depuis un theme)

1. Selectionner le mode **"Tout generer"**
2. Saisir un theme/sujet (ex: "Gestion de la securite des systemes")
3. Renseigner le nom de l'etudiant et la promotion
4. Cliquer sur **Lancer**
5. Suivre la progression en temps reel (logs des agents)
6. Telecharger les 3 fichiers generes (PA + PR + CER)

### Mode 2 : Depuis un Prosit Aller existant

1. Selectionner le mode **"J'ai le Prosit Aller"**
2. Importer un fichier PA existant (DOCX, PPTX, JSON ou PDF)
3. Le systeme genere le Prosit Retour + CER
4. Telecharger les fichiers generes

### Mode 3 : Depuis un Prosit Retour existant

1. Selectionner le mode **"J'ai le Prosit Retour"**
2. Importer un fichier PR existant (DOCX, PPTX, JSON ou PDF)
3. Le systeme genere uniquement le CER
4. Telecharger le fichier genere

### Formats d'import supportes

- `.docx` (Word)
- `.pptx` (PowerPoint)
- `.pdf` (PDF)
- `.json` (JSON structure)

### Fichiers generes

Les documents sont sauvegardes dans `backend/output/` avec le nommage :

```
01_Prosit_Aller_<theme>.docx
02_Prosit_Retour_<theme>.pptx
03_CER_<theme>.docx
```

---

## API REST

Le backend expose les endpoints suivants sur `http://localhost:3001` :

### `GET /api/status`

Verification de l'etat du serveur.

**Reponse :**
```json
{
  "ok": true,
  "version": "3.0",
  "formats": ["docx", "pptx", "pdf", "json", "txt"]
}
```

### `POST /api/parse`

Import et analyse d'un fichier existant (DOCX, PPTX, PDF, JSON).

**Corps :** `multipart/form-data` avec le fichier

**Reponse :** JSON structure du document importe

### `POST /api/run`

Lancement du pipeline multi-agents. Retourne un flux SSE (Server-Sent Events).

**Corps :**
```json
{
  "theme": "Gestion de la securite",
  "student": "MAYACK ETIENNE",
  "promotion": "X2027",
  "mode": "full",
  "existingData": null
}
```

**Modes disponibles :**
- `full` : theme -> PA + PR + CER
- `from_pa` : PA importe -> PR + CER
- `from_pr` : PR importe -> CER

**Evenements SSE :**

| Evenement | Description |
|-----------|-------------|
| `log` | Logs de raisonnement des agents (thought, action, observation) |
| `step` | Etapes majeures du pipeline |
| `done` | Pipeline termine, contient les fichiers generes |
| `error` | Erreur dans le pipeline |

### `GET /api/download/:filename`

Telechargement d'un fichier genere.

**Exemple :**
```
GET /api/download/01_Prosit_Aller_gestion_securite.docx
```

---

## Fonctionnement des agents

Chaque agent suit le **pattern ReAct** (Reasoning + Acting) :

```
Boucle ReAct :
  1. THOUGHT  — L'agent raisonne sur l'etat actuel
  2. ACTION   — L'agent execute un outil (validate_structure, check_coherence, analyze_memory)
  3. OBSERVATION — L'agent observe le resultat
  4. Repeter jusqu'a ce que le resultat soit satisfaisant
  5. RESULT   — L'agent produit le JSON final
```

### Agent 1 — Prosit Aller

- **Entree :** Theme/sujet
- **Sortie :** JSON structure avec tous les champs du PA
- **Generation :** Fichier DOCX formate avec logos UCAC-ICAM

### Agent 2 — Prosit Retour

- **Entree :** Memoire partagee (contient le PA de l'Agent 1)
- **Sortie :** JSON structure avec les 12 sections du PR
- **Generation :** Fichier PPTX avec 12 slides formatees

### Agent 3 — CER

- **Entree :** Memoire partagee (contient le PA + PR)
- **Sortie :** JSON structure avec toutes les sections du CER
- **Generation :** Fichier DOCX complet et formate

### Memoire partagee

L'orchestrateur maintient un objet memoire commun :

```javascript
memory = {
  theme: "...",
  student: "...",
  promotion: "...",
  prositAller: { /* JSON genere par Agent 1 */ },
  prositRetour: { /* JSON genere par Agent 2 */ },
  cer: { /* JSON genere par Agent 3 */ }
}
```

Chaque agent peut lire la memoire pour acceder aux resultats des agents precedents, garantissant la coherence entre les documents.

---

## Formats supportes

### Import

| Format | Extension | Utilisation |
|--------|-----------|-------------|
| Word | `.docx` | Prosit Aller ou Retour existant |
| PowerPoint | `.pptx` | Prosit Retour existant |
| PDF | `.pdf` | Tout document pedagogique |
| JSON | `.json` | Donnees structurees |

### Export

| Document | Format | Contenu |
|----------|--------|---------|
| Prosit Aller | `.docx` | Document Word avec mise en forme et logos |
| Prosit Retour | `.pptx` | Presentation PowerPoint 12 slides |
| CER | `.docx` | Document Word complet avec bibliographie |

---

## Auteur

| | |
|---|---|
| **Etudiant** | MAYACK ETIENNE |
| **Promotion** | X2027 |
| **Etablissement** | UCAC-ICAM |
| **Annee academique** | 2025 - 2026 |
| **Tuteurs** | Mr. Humphrey ODJONG · Mrs. Mathilde PUTHOD |

---

## Licence

Projet academique - UCAC-ICAM
