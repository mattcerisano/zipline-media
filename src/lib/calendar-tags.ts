/**
 * Tags Slate writes to `extendedProperties.private.app` on the Google events it
 * owns. Their own module because both the pull (calendar-sync) and the push
 * (calendar-google) need them, and importing either from the other would make
 * the two files circular.
 */

/** Written on every event Slate pushes for a production. */
export const SLATE_APP_TAG = 'zipline-slate';

/**
 * Tag for calendar *markers* pushed from the Calendar tab (Hold, Meeting, ...).
 *
 * Deliberately distinct from SLATE_APP_TAG: the job sync treats anything
 * carrying that tag as a production and would turn every Hold into a job. The
 * importer skips events carrying this one instead - the local row is the
 * source of truth for them, so re-importing would both duplicate the marker
 * and overwrite its preset with 'google'.
 */
export const STUDIO_MARKER_TAG = 'zipline-marker';
