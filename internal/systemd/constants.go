package systemd

import "time"

const (
	// Default timeout values
	defaultUnitTimeout = 5 * time.Second
	journalWaitTimeout = time.Second

	// Job mode and result constants
	jobModeReplace = "replace"
	jobResultDone  = "done"

	// Journal field names
	journalMessageField = "MESSAGE"
	journalUnitField    = "_SYSTEMD_UNIT"

	// Time conversion constants
	microsecondsPerSecond     = 1000000
	nanosecondsPerMicrosecond = 1000
)
