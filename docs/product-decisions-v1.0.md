1. Positionnement produit (décision ferme)
❌ ATLAS n’est PAS un outil d’aide
✅ ATLAS est une autorité bloquante assumée

👉 Décision finale :
ATLAS décide. L’utilisateur arbitre seulement quand ATLAS l’autorise.

Raisons :

Un outil “conseiller” = rejeté par Google à moyen terme

Les agences veulent un garde-fou, pas un avis de plus

La valeur perçue vient du NON expliqué, pas du OUI automatique

Formule officielle :

“ATLAS est un SEO Lead virtuel.
Il bloque, impose une review ou autorise.
Il n’exécute jamais sans décision.”

2. Workflow produit global (source de vérité)
2.1 Deux workflows distincts (non fusionnables)
A) Créer un nouveau contenu

Workflow par défaut.

Plan → PRECHECK (G0–G3)
→ BLOCK / REVIEW / PASS
→ (si PASS) Génération draft
→ SCORE (A–F + G4–G6)
→ BLOCK / REVIEW / PASS
→ Publication ou Draft

B) Mettre à jour une page existante

Workflow explicitement choisi par l’utilisateur.

Sélection page existante
→ Analyse page (SCORE existant)
→ Recommandations ATLAS
→ Mise à jour assistée
→ SCORE
→ PASS / REVIEW


👉 Décision produit clé
ATLAS ne bascule jamais automatiquement de “nouveau contenu” vers “update”
➡️ il propose, l’humain choisit

3. Cas critique : collision topic_key (décision officielle)
3.1 Collision détectée (G2 registry strict)

Comportement ATLAS (non négociable) :

❌ génération interdite

❌ aucun draft créé

✅ décision = BLOCK

✅ message explicite

3.2 Ce que l’UI doit afficher (contrat UI ↔ moteur)

Message utilisateur standardisé :

❌ Publication bloquée — sujet déjà couvert

Ce sujet est déjà traité par une page de référence :
👉 {reference_url}

Action recommandée :

Mettre à jour la page existante

OU choisir un angle réellement différent (nouvelle intention)

Boutons UI :

→ Mettre à jour la page existante (recommandé)

→ Changer de sujet / angle

👉 Aucune option “forcer quand même”
Sinon ATLAS perd toute crédibilité.

4. Contrat UI ↔ moteur (très important)
4.1 Mapping décision → UX
Décision ATLAS	UX obligatoire
BLOCK	écran bloquant + raisons + actions
REVIEW	draft visible + validation humaine requise
PASS	publication autorisée
PREMIUM	badge + priorisation
4.2 Mapping reasons → actions concrètes

Chaque reason doit générer une action claire dans l’UI.

Exemples :

Reason : C1_QA_COVERAGE

UI affiche :

“Ajouter une section FAQ (3–5 questions réelles)”

bouton Voir les sections manquantes

Reason : HIGH_CANNIBALIZATION_POST

UI affiche :

lien vers page concurrente

choix :

enrichir page existante

revoir l’angle

Reason : PILLAR_CREATION

UI affiche :

“Page pilier = validation obligatoire”

badge “Stratégique”

bouton Envoyer en validation

👉 Aucune reason ne doit rester “abstraite”

5. User Journeys validés (MVP UI)
Journey 1 — Agence sérieuse (cas majoritaire)

Ajoute un site

Planifie 10 sujets

ATLAS bloque 3 sujets (duplication / collision)

ATLAS force review sur 2 (pages piliers)

5 passent → publiés

Audit log consulté pour reporting client

➡️ Valeur perçue élevée
➡️ Confiance

Journey 2 — Freelance SEO

Colle un draft existant

Lance SCORE

ATLAS dit REVIEW (74)

Modifie le contenu

Repasse SCORE

ATLAS dit PASS

➡️ ATLAS = coach + garde-fou

Journey 3 — E-commerce pressé (profil à risque)

Tente de publier 5 pages proches

ATLAS bloque 3

Explique pourquoi

Propose update existant

➡️ ATLAS protège le site malgré le client

6. Go / No-Go UI MVP
✅ GO UI MVP si et seulement si :

UI respecte BLOCK sans contournement

UI affiche toujours :

décision

reasons

suggested_action

ruleset_version

UI ne permet aucune publication directe sans PASS

❌ NO-GO si :

bouton “publier quand même”

suppression de reasons visibles

UI masque le BLOCK ou le REVIEW

7. Roadmap v1.1 (décisions)
7.1 Ce qui reste core (gratuit / inclus)

PRECHECK G0–G3

SCORE A–F

BLOCK / REVIEW / PASS

Registry strict

Audit log basique

👉 Sinon le produit perd sa raison d’être.

7.2 Ce qui devient premium

Mise à jour assistée des pages existantes

Historique comparatif des scores (avant/après)

Analytics :

top raisons de blocage

clusters saturés

Mode agence :

multi-review

commentaires

batch validation

8. Décision finale (à graver)

**ATLAS n’est pas un générateur.
ATLAS est un moteur de décision SEO.

Si l’UI affaiblit cette autorité, le produit est rejeté.** 
