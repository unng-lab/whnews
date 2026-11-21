import { createLiveRadioSchedule } from './radio-program-v3.mjs';

export { createLiveRadioSchedule, validateRadioProgram, fetchRadioProgram, dialogueSamples } from './radio-program-v3.mjs';

function retainsTracks(from, to) {
  return Array.isArray(to?.tracks) && to.tracks.length >= from.tracks.length &&
    from.tracks.every((track, index) => {
      const next = to.tracks[index];
      return next?.id === track.id && next.src === track.src &&
        next.durationMs === track.durationMs && next.sha256 === track.sha256;
    });
}

function checkRetainedBanks(current, previous, now) {
  const known = (current.banks ?? []).map(bank => Date.parse(bank.effectiveAtUtc));
  const offered = new Set(previous.banks.map(bank => Date.parse(bank.effectiveAtUtc)));
  const active = known.findLast(time => time <= now) ?? -Infinity;
  if (known.some(time => time >= active && !offered.has(time)) ||
      [...offered].some(time => time >= active && time <= known.at(-1) && !known.includes(time))) {
    throw new TypeError('Previous radio program changes a current or scheduled edition');
  }
}

export function createCatalogRadioSchedule(initialMusic, now = Date.now) {
  let music = initialMusic;
  let schedule = createLiveRadioSchedule(music);
  return {
    get music() { return music; },
    atUtc(now) { return schedule.atUtc(now); },
    speechSlots(now) { return schedule.speechSlots(now); },
    update(program) {
      const incoming = program?.catalog;
      if (!incoming || incoming.programCatalogId === music.programCatalogId) {
        schedule.update(program);
        return;
      }
      if (!retainsTracks(music, incoming) || incoming.tracks.length === music.tracks.length ||
          typeof incoming.programCatalogId !== 'string' ||
          incoming.programCatalogId !== program.catalogId ||
          (schedule.program && Date.parse(program.transitionAtUtc) <= Date.parse(schedule.program.transitionAtUtc))) {
        throw new TypeError('Incompatible radio catalog update');
      }
      const prior = program.previousEdition;
      if (!retainsTracks(music, prior?.music)) throw new TypeError('Previous radio catalog differs');
      const updated = createLiveRadioSchedule(incoming);
      updated.update(program);
      if (prior.music.tracks.length >= incoming.tracks.length || !retainsTracks(prior.music, incoming)) {
        throw new TypeError('Expansion changes the previous radio catalog');
      }
      const receivedAt = now();
      if (Date.parse(prior.program.transitionAtUtc) > receivedAt) {
        throw new TypeError('Previous radio catalog is not active yet');
      }
      if (prior.music.programCatalogId === music.programCatalogId) {
        if (prior.music.tracks.length !== music.tracks.length ||
            prior.music.shuffleSeed !== music.shuffleSeed || prior.music.epochUtc !== music.epochUtc) {
          throw new TypeError('Previous radio catalog differs');
        }
        if (schedule.program) {
          checkRetainedBanks(schedule.program, prior.program, receivedAt);
          const trial = createLiveRadioSchedule(music);
          trial.update(schedule.program);
          trial.update({ ...prior.program, previousEdition: schedule.program.previousEdition });
        }
      } else if (prior.music.tracks.length === music.tracks.length) {
        throw new TypeError('Previous radio catalog differs');
      }
      schedule = updated;
      music = incoming;
    },
  };
}
