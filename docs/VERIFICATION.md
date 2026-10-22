# Vérification du 16 octobre 2026

L’application enregistre une séance depuis l’interface vers une route HTTP Next.js, puis vers une RPC transactionnelle Supabase et des tables PostgreSQL normalisées. La réponse serveur détermine l’état de sauvegarde de l’interface.

| Contrôle | Résultat observé | Portée |
| --- | --- | --- |
| TypeScript strict | Réussi, aucune erreur | Code de l’application, scripts et tests |
| ESLint TypeScript / React / accessibilité | Réussi, aucune erreur | Code source |
| Vitest | **51 tests réussis** | Calculs, recommandations, validation, clones, SQL/RLS, sauvegarde et parcours des composants |
| Migration et seed | Exécutés avec succès | PostgreSQL embarqué PGlite, catalogue de 62 exercices et re-seed sans doublon |
| Isolation SQL | Réussie | Deux rôles authentifiés, programmes, enfants, exercices privés, séances, séries et poids ; fonctions admin inaccessibles |
| Transactions | Réussies | Instantanés préservés, sauvegardes obsolètes refusées, erreur tardive annulant l’écriture complète, repos par tour conservé |
| Suppression en cascade | Réussie | Suppression d’un utilisateur de test et disparition des données privées liées |
| Sauvegarde React | Réussie | Confirmation serveur, panne et nouvel essai, sérialisation des modifications, reprise locale, conflit et séparation des comptes |
| Composants privés dans le DOM | 2 tests réussis (inclus dans Vitest) | Création de programme avec exercices/superset et soumission valide ; menu mobile donnant accès aux records, au poids, aux paramètres et à la déconnexion |
| Playwright desktop | **2 tests réussis** | Vérification répétée sur le build de production : connexion sans erreur JavaScript/console, sans inscription ni débordement horizontal ; protection page/API sans session |
| Playwright mobile | **2 tests réussis** | Mêmes contrôles sur le build de production avec un viewport iPhone, moteur Chromium/Edge |
| Playwright privé Supabase réel | **2 tests ignorés** | Requiert `E2E_LIVE=1`, les clés d’un projet de test et le domaine technique du propriétaire |
| Inspection visuelle | Connexion ordinateur et téléphone inspectée | Captures dans `docs/previews/` ; les écrans privés n’ont pas été inspectés avec une vraie session |
| Build Next.js production | Réussi avec Webpack | Compilation, types et génération des routes ; Turbopack a échoué sur un processus CSS Windows |
| Audit npm | Aucune vulnérabilité signalée | Dépendances de production et de développement, audit exécuté en fin de vérification |
| Déploiement Vercel | **READY** | Production `https://forge-maelgibelot.vercel.app`, source `MaelGibelot/forge`, fonctions Paris |
| Playwright production distante | **4 tests réussis** | Ordinateur et mobile, rendu sans erreur console/JavaScript, aucune inscription, pages et API privées protégées |
| Backend production distante | Réussi pour les contrôles sans session | API privée 401, connexion inconnue 401 via fonctions serveur Supabase, origine étrangère 403 |
| Supabase hébergé | Migrations et seed appliqués | 62 exercices, 10 groupes musculaires, RLS sur les 16 tables publiques, diagnostics sans avertissement de sécurité/performance après indexation |

La stack Supabase complète n’a pas été lancée localement : Docker n’était pas disponible. PGlite exécute la migration et les politiques dans un moteur PostgreSQL embarqué ; les tables et fonctions minimales du schéma Auth sont préparées par les tests. Ce contrôle ne prouve pas le fonctionnement de Supabase Auth, de son service HTTP ni de PostgREST.

## Parcours encore à vérifier sur le service réel

1. Réalisé : migrations et seed appliqués au projet `egzytutkpnkdyafgdsrv`, diagnostics Supabase exécutés. Les deux tables privées sans politique cliente et les index encore inutilisés sont des informations attendues.
2. Réalisé : inscriptions publiques et anonymes désactivées, fournisseur email/mot de passe conservé, minimum de 12 caractères. Les comptes admin seront directement confirmés sans envoi d’email ; aucun compte n’a encore été créé.
3. Créer deux comptes avec le script admin ; vérifier la connexion par identifiant et la persistance après reconnexion.
4. Activer les tests Playwright privés sur un projet de test. Ils couvrent programme, exercices, superset, saisie RPE/RIR/repos, brouillon, rechargement, finalisation, historique, graphique, records, correction d’une ancienne séance, thème et isolation entre comptes.
5. Vérifier changement de mot de passe, réinitialisation propriétaire, suppression réelle du compte et révocation de sessions.
6. Réalisé pour HTTPS, l’origine exacte, le déploiement et le rejet d’identifiants inconnus ; les cookies d’une vraie session et la limitation après tentatives répétées restent à vérifier avec les comptes de test.

Les tests ignorés ne sont pas comptés comme réussis. Aucune connexion, donnée distante ou publication n’est présentée comme validée sans preuve.

## Évolution : 7 jours, carte musculaire et suppression depuis la séance

- 59 tests Vitest réussis : ajout de la période de 7 jours avec contrôle de la borne temporelle, exclusion des brouillons et séries non validées, filtre d’échauffement, couleurs des zones et bascule principales/secondaires.
- Suppression depuis une séance libre active, en brouillon ou terminée : confirmation annulable, requête avec sa révision et retour vers l’historique. Tests de suppression pendant une sauvegarde, abandon des modifications en attente, absence de recréation après reconnexion, conservation de la récupération sur erreur réseau et protection des conflits.
- Contrôle navigateur local sur ordinateur et iPhone simulé : filtres, carte, absence de débordement, thèmes sombre/clair, annulation puis confirmation d’une suppression. Ces parcours utilisent une API de test interceptée ; ils ne valident pas une session Supabase réelle. L’aperçu temporaire a été retiré du code de l’application avant publication.
- Captures de la carte avec données de test dans `docs/previews/statistiques-muscles-test.png` et `docs/previews/statistiques-muscles-clair-test.png`.
- Aucune migration, modification des comptes ou suppression de séance réelle n’est nécessaire pour cette évolution. L’API existante conserve le contrôle du propriétaire et de la révision ; les statistiques et records excluent les séances supprimées lors du rechargement des données.

## Évolution : catalogue Technogym et suivi cardio

- 331 fiches au total : les 62 identifiants d’origine restent inchangés ; 269 fiches Technogym sont ajoutées, dont 45 cardio, avec des identifiants stables par gamme, modèle et mouvement. Les variantes de console/couleur ne créent pas de doublons. Sources et périmètre détaillés dans `docs/TECHNOGYM.md`.
- 79 tests Vitest réussis : intégrité du catalogue, recherche dans la bibliothèque et le sélecteur, programme cardio, saisie d’intervalles, validation des durées/distances, sauvegarde SQL, lecture, annulation d’une écriture invalide et isolation des nouvelles mesures entre comptes sous RLS. Le seed est exécuté deux fois sans doublon sur PostgreSQL embarqué.
- La migration ajoute deux colonnes nullables à `workout_sets`, autorise le mode cardio, ajoute le groupe Adducteurs et adapte la RPC transactionnelle sans modifier ses droits. Un trigger `SECURITY INVOKER` valide le mode en écriture directe : un intervalle cardio validé exige une durée positive, sans répétitions, charge ou RIR ; une série de musculation garde ses contraintes antérieures.
- Contrôles navigateur locaux sur ordinateur et iPhone simulé avec une API de test : filtres Technogym et Cardio, recherche Skill/Pure Strength, saisie 20 min 30 s et 4,5 km, sauvegarde et rechargement, finalisation de séance, indicateurs cardio et carte musculaire sans séries ajoutées par le cardio. Aucune erreur JavaScript ni débordement horizontal observé. Ces contrôles ne constituent pas un test d’authentification Supabase réelle.
- Captures locales avec données de test dans `docs/previews/technogym-*-test.png` et `docs/previews/cardio-*-test.png`. Les pages temporaires de vérification sont retirées avant compilation et publication.
- Le déploiement du code compatible précède l’insertion du nouveau catalogue en production. L’insertion est réexécutable et ne remplace ni les exercices personnels, ni les programmes, ni les séances existantes.
- Diagnostic Supabase après migration : RLS actif sur les tables privées sans accès client (information attendue). Un avertissement Auth signale la protection contre les mots de passe divulgués désactivée ; cette option nécessite le forfait Pro ou supérieur selon la [documentation Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Aucun changement de forfait n’est effectué.

## Évolution du 22 octobre : accessoires, prises et séances simplifiées

- 42 variantes ajoutées : barres droite, EZ, marteau, suisse, trap bar, pupitres Scott (barre, haltère, poulie, machine), tirages verticaux et horizontaux avec pronation, supination ou prise neutre, large/serrée, poignée en V, corde ou poignées individuelles. Chaque fiche possède son identifiant et son historique ; les 331 fiches existantes restent inchangées (373 au total).
- Les champs et colonnes RPE/RIR sont retirés des séances de musculation, du cardio et des objectifs. Les valeurs historiques restent stockées sans transformation. La structure SQL, les règles de sauvegarde et les droits ne changent pas.
- Les répétitions réalisées, les objectifs des programmes et les réglages des exercices utilisent une liste de 1 à 30. Une ancienne valeur hors plage reste affichée et conservée jusqu’à un choix explicite.
- 81 tests Vitest réussis, dont modification des répétitions et sauvegarde avec conservation des anciens RPE/RIR, recherche de variantes et modification d’objectif. Le seed complet est exécuté deux fois dans PostgreSQL embarqué sans doublon.
- Vérification locale dans le navigateur sur ordinateur et iPhone simulé : sélection 30, sauvegarde/rechargement, conservation des efforts historiques, ajout d’un tirage avec prise distincte, absence d’erreurs JavaScript et de débordement horizontal. API de test interceptée, sans connexion à un compte réel. Captures `docs/previews/seance-simplifiee-*-test.png`. La page d’aperçu temporaire est supprimée avant publication.

## Évolution : bilan individuel, tractions et dips

- La finalisation d’une séance reste sur sa fiche et ouvre son bilan. Les séances terminées rouvertes depuis l’historique affichent aussi ce bilan. La modification le masque temporairement ; les corrections enregistrées le recalculent.
- Graphique en barres des séries directes/indirectes par muscle, données tabulaires accessibles, carte avant/arrière, totaux de séries, répétitions, volume externe et mesures cardio. Échauffements exclus par défaut et réactivables ; séries non validées et cardio exclus des séries musculaires. Les secondaires proviennent des fiches d’exercice disponibles, sans données inventées en leur absence. La même fonction de comptage sert aux statistiques sur plusieurs jours.
- 15 variantes ajoutées (388 fiches au total), dont six prises de tractions sur machine assistée et deux écartements de dips assistés. Les huit mouvements assistés utilisent `load_kind=assisted` : aide affichée en kg, pas de volume externe ni de record de charge. Les identifiants précédents sont conservés ; aucune migration SQL ni modification des données personnelles n’est nécessaire.
- 84 tests Vitest réussis : bilan isolé, échauffements, séries dégressives/non réalisées, blocs multiples, cardio exclu, absence de métadonnées secondaires, invariance des données et mouvements assistés. Le seed complet est testé deux fois sous PostgreSQL embarqué.
- Contrôle du navigateur local sur ordinateur et iPhone simulé : finaliser, consulter le véritable graphique Recharts, changer le filtre et la carte directe/secondaire, vérifier le tableau et recharger le bilan. Aucun débordement horizontal ni erreur JavaScript. API de test interceptée ; aucune session Auth réelle utilisée. Captures `docs/previews/bilan-seance-*-test.png`. La page d’aperçu est retirée avant compilation de production.
