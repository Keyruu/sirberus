// web/embed.go
package web

import (
	"embed"
	"io/fs"
)

//go:embed dist/*
var assets embed.FS

func AssetsFS() (fs.FS, error) {
	sub, err := fs.Sub(assets, "dist")
	if err != nil {
		return nil, err
	}
	return sub, nil
}
