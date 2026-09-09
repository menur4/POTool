/**
 * Service de calcul de capacité pour les sprints
 */

/**
 * Calcule le nombre de jours ouvrés entre deux dates
 * @param {Date} startDate - Date de début
 * @param {Date} endDate - Date de fin
 * @param {Array} holidays - Liste des jours fériés (optionnel)
 * @returns {number} Nombre de jours ouvrés
 */
const getWorkingDays = (startDate, endDate, holidays = []) => {
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);

  // Convertir les jours fériés en timestamps pour une comparaison rapide
  const holidayTimestamps = holidays.map(h => new Date(h).setHours(0, 0, 0, 0));

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const currentTimestamp = current.setHours(0, 0, 0, 0);

    // Exclure weekends (0 = dimanche, 6 = samedi) et jours fériés
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayTimestamps.includes(currentTimestamp)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};

/**
 * Calcule la capacité planifiée d'un sprint
 * @param {Object} sprint - Objet sprint avec team et constraints
 * @param {Array} holidays - Liste des jours fériés (optionnel)
 * @returns {Object} Détails de la capacité calculée
 */
const calculatePlannedCapacity = (sprint, holidays = []) => {
  const { startDate, endDate, team, constraints } = sprint;

  // Nombre de jours ouvrés dans le sprint
  const totalWorkingDays = getWorkingDays(startDate, endDate, holidays);

  // Calculer la capacité par membre
  const memberCapacities = team.map(teamEntry => {
    const availabilityRate = (teamEntry.availability || 100) / 100;
    const memberWorkingDays = totalWorkingDays - (teamEntry.daysOff || 0);
    const effectiveDays = memberWorkingDays * availabilityRate;

    return {
      memberId: teamEntry.member,
      totalDays: totalWorkingDays,
      daysOff: teamEntry.daysOff || 0,
      availability: teamEntry.availability || 100,
      effectiveDays: Math.max(0, effectiveDays)
    };
  });

  // Capacité brute totale (somme des jours effectifs)
  const grossCapacity = memberCapacities.reduce((sum, m) => sum + m.effectiveDays, 0);

  // Appliquer les contraintes (fallback supportPercent pour rétrocompatibilité)
  const meetingsPercent = (constraints?.meetingsPercent || 10) / 100;
  const bugsPercent = (constraints?.bugsPercent || 10) / 100;
  const tnrPercent = (constraints?.tnrPercent ?? constraints?.supportPercent ?? 5) / 100;

  const totalConstraintsPercent = meetingsPercent + bugsPercent + tnrPercent;
  const netCapacity = grossCapacity * (1 - totalConstraintsPercent);

  return {
    totalWorkingDays,
    teamSize: team.length,
    memberCapacities,
    grossCapacity: Math.round(grossCapacity * 10) / 10,
    constraints: {
      meetings: Math.round(grossCapacity * meetingsPercent * 10) / 10,
      bugs: Math.round(grossCapacity * bugsPercent * 10) / 10,
      tnr: Math.round(grossCapacity * tnrPercent * 10) / 10,
      total: Math.round(grossCapacity * totalConstraintsPercent * 10) / 10
    },
    netCapacity: Math.round(netCapacity * 10) / 10
  };
};

/**
 * Calcule la capacité réelle d'un sprint (à utiliser lors de la clôture)
 * @param {Object} sprint - Objet sprint
 * @param {Object} actualData - Données réelles (congés réels, réunions réelles, etc.)
 * @returns {Object} Capacité réelle calculée
 */
const calculateActualCapacity = (sprint, actualData = {}) => {
  const { startDate, endDate } = sprint;
  const actualTeam = actualData.team || sprint.actualTeam || sprint.team;
  const totalWorkingDays = getWorkingDays(startDate, endDate, actualData.holidays || []);

  // Utiliser les données réelles
  const memberCapacities = actualTeam.map(teamEntry => {
    const daysOff = teamEntry.daysOff ?? 0;
    const availability = teamEntry.availability ?? 100;
    const availabilityRate = availability / 100;
    const memberWorkingDays = totalWorkingDays - daysOff;
    const effectiveDays = memberWorkingDays * availabilityRate;

    return {
      memberId: teamEntry.member,
      totalDays: totalWorkingDays,
      daysOff,
      availability,
      effectiveDays: Math.max(0, effectiveDays)
    };
  });

  const grossCapacity = memberCapacities.reduce((sum, m) => sum + m.effectiveDays, 0);

  // Contraintes réelles (fallback supportPercent pour rétrocompatibilité)
  const actualConstraints = actualData.constraints || sprint.actualConstraints || sprint.constraints;
  const meetingsPercent = (actualConstraints?.meetingsPercent ?? sprint.constraints?.meetingsPercent ?? 10) / 100;
  const bugsPercent = (actualConstraints?.bugsPercent ?? sprint.constraints?.bugsPercent ?? 10) / 100;
  const tnrPercent = (actualConstraints?.tnrPercent ?? actualConstraints?.supportPercent ?? sprint.constraints?.tnrPercent ?? sprint.constraints?.supportPercent ?? 5) / 100;

  const totalConstraintsPercent = meetingsPercent + bugsPercent + tnrPercent;
  const netCapacity = grossCapacity * (1 - totalConstraintsPercent);

  return {
    totalWorkingDays,
    teamSize: actualTeam.length,
    memberCapacities,
    grossCapacity: Math.round(grossCapacity * 10) / 10,
    constraints: {
      meetings: Math.round(grossCapacity * meetingsPercent * 10) / 10,
      bugs: Math.round(grossCapacity * bugsPercent * 10) / 10,
      tnr: Math.round(grossCapacity * tnrPercent * 10) / 10,
      total: Math.round(grossCapacity * totalConstraintsPercent * 10) / 10
    },
    netCapacity: Math.round(netCapacity * 10) / 10
  };
};

/**
 * Estime la vélocité basée sur l'historique des sprints
 * @param {Array} pastSprints - Sprints passés avec vélocité réelle
 * @param {number} sprintsToConsider - Nombre de sprints à considérer (défaut: 3)
 * @returns {Object} Estimation de vélocité
 */
const estimateVelocity = (pastSprints, sprintsToConsider = 3) => {
  // Filtrer les sprints fermés avec une vélocité réelle
  const closedSprints = pastSprints
    .filter(s => s.status === 'closed' && s.velocity?.actual > 0)
    .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))
    .slice(0, sprintsToConsider);

  if (closedSprints.length === 0) {
    return {
      average: 0,
      min: 0,
      max: 0,
      sprintsAnalyzed: 0,
      trend: 'unknown'
    };
  }

  const velocities = closedSprints.map(s => s.velocity.actual);
  const average = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;

  // Calculer la tendance
  let trend = 'stable';
  if (velocities.length >= 2) {
    const recentAvg = velocities.slice(0, Math.ceil(velocities.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(velocities.length / 2);
    const olderAvg = velocities.slice(Math.ceil(velocities.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(velocities.length / 2);

    if (recentAvg > olderAvg * 1.1) trend = 'increasing';
    else if (recentAvg < olderAvg * 0.9) trend = 'decreasing';
  }

  return {
    average: Math.round(average * 10) / 10,
    min: Math.min(...velocities),
    max: Math.max(...velocities),
    sprintsAnalyzed: closedSprints.length,
    trend
  };
};

module.exports = {
  getWorkingDays,
  calculatePlannedCapacity,
  calculateActualCapacity,
  estimateVelocity
};
