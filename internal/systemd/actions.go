package systemd

import (
	"context"
	"fmt"

	"github.com/coreos/go-systemd/v22/dbus"
)

type unitOperation func(ctx context.Context, conn *dbus.Conn, name string, mode string, ch chan<- string) (int, error)

func (s *SystemdService) StartUnit(name string) error {
	return s.executeUnitOperation(name, "start", func(ctx context.Context, conn *dbus.Conn, name, mode string, ch chan<- string) (int, error) {
		return conn.StartUnitContext(ctx, name, mode, ch)
	})
}

func (s *SystemdService) StopUnit(name string) error {
	return s.executeUnitOperation(name, "stop", func(ctx context.Context, conn *dbus.Conn, name, mode string, ch chan<- string) (int, error) {
		return conn.StopUnitContext(ctx, name, mode, ch)
	})
}

func (s *SystemdService) RestartUnit(name string) error {
	return s.executeUnitOperation(name, "restart", func(ctx context.Context, conn *dbus.Conn, name, mode string, ch chan<- string) (int, error) {
		return conn.RestartUnitContext(ctx, name, mode, ch)
	})
}

func (s *SystemdService) executeUnitOperation(name, operation string, fn unitOperation) error {
	ctx, cancel := context.WithTimeout(context.Background(), defaultUnitTimeout)
	defer cancel()

	conn, err := s.newConnection(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	ch := make(chan string)
	_, err = fn(ctx, conn, name, jobModeReplace, ch)
	if err != nil {
		return fmt.Errorf("failed to %s unit %s: %w", operation, name, err)
	}

	result := <-ch
	if result != jobResultDone {
		return fmt.Errorf("failed to %s unit %s: job result was %s", operation, name, result)
	}

	return nil
}
