# Escalade — voies et bloc

Deux fiches globales dans la collection **Sports · Escalade** : voies et bloc. Chaque passage possède une cotation, un résultat (tenté/réussi), un nombre d’essais entre 1 et 100 et des notes pour la voie, le secteur ou la salle. En voie, la pratique en tête/moulinette est facultative. La case « enregistré » indique que le passage est consigné ; elle ne signifie pas qu’il est réussi.

Les valeurs suivent la notation française chiffre/lettre/+ ; les lettres du bloc sont affichées en majuscules pour distinguer les disciplines, avec une valeur interne canonique en minuscules. La liste supporte les niveaux 1 à 9 avec subdivisions jusqu’à 9c+ ; c’est une capacité de saisie, pas une liste de records mondiaux reconnus. Ni couleurs propres aux salles ni cotations internationales ne sont converties.

La [norme FFME de classement et de cotation, section 5](https://www.ffme.fr/wp-content/uploads/2019/03/2013-normes-classement-1.pdf) décrit l’ordre chiffre/lettre/+, par exemple 6c < 6c+ < 7a. Ce document ancien sert de référence à la notation, pas aux niveaux maximaux actuels. Les voies et blocs sont analysés séparément. Une cotation est un repère de difficulté : aucune équivalence en kilogrammes, distance physique, 1RM ou séries musculaires n’est calculée.

## Suivi

- Une ligne par passage travaillé pendant cette séance ; le nombre d’essais est déclaré pour cette ligne. Aucun identifiant de voie réelle n’est supposé : les compteurs ne représentent pas des voies uniques tous sites confondus.
- Le bilan affiche passages travaillés/réussis et meilleure cotation réussie par discipline. Les tentatives seules ne donnent pas de meilleure cotation.
- La fiche de l’activité affiche l’historique des passages des séances terminées, lié à chaque séance.
- Dans Statistiques, sélectionner l’activité : meilleure cotation réussie, nombre de passages travaillés ou réussis. Le graphique en paliers montre un ordre de cotations ; la distance visuelle entre niveaux ne mesure pas un écart uniforme d’effort. Le tableau et les infobulles affichent la cotation, jamais son rang interne.
- Les pratiques de corde sont stockées dans chaque passage ; le maximum de voie agrège les pratiques renseignées, sans prétendre mesurer un record en tête spécifique.
- Les séances mixtes musculation/cardio/escalade restent possibles. Les passages n’ajoutent aucune répétition, aucun volume externe, temps cardio ou série de musculation. Ils ne déclenchent pas de progression de charge ni de diagnostic de fatigue dans le coach.
- Copies et modèles conservent la structure et repartent sans cotation, réussite, essais réalisés ou pratique précédente.

## Sauvegarde et compatibilité

Modes `climbing` et `bouldering`, champ additif nullable `workout_sets.climbing` en JSON. Validation Zod et trigger SQL concordants : cotation requise pour un passage enregistré ; résultat et essais valides ; aucun champ de charge/répétitions/effort musculaire ni durée cardio sur un passage. Une cotation est refusée sur les séries de musculation/cardio. La RPC existante reste transactionnelle, avec révision et `SECURITY INVOKER`. Aucun changement de politique RLS ni droit anonyme ; anciens payloads sans champ escalade toujours acceptés.

Deux fiches ajoutées par migration et dans le seed réexécutable. Les 388 fiches précédentes et les performances historiques sont conservées, soit 390 fiches globales.
