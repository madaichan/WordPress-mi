<?php
/**
 * Canonical GoPhish timeline event labels for the chained stages.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

/**
 * The labels GoPhish gives the downstream submissions it folds back into a
 * source campaign's timeline (docs/api_campaignnew.md §3.5.1).
 *
 * Kept in one place because two services now match on them —
 * CampaignRunService to count stages, QuizScoringService to grade answers —
 * and a typo in either would silently stop finding submissions.
 */
final class QuizEventTypes {

	/** A quiz answer submitted downstream, merged into the source timeline. */
	public const QUIZ = 'Submitted Data (Quiz)';

	/** An education submission; `(Chained)` is the fallback for other types. */
	public const EDUCATION = 'Submitted Data (Education)';
	public const CHAINED   = 'Submitted Data (Chained)';
}
