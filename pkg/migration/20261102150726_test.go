// Vikunja is a to-do list application to facilitate your life.
// Copyright 2018-present Vikunja and contributors. All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package migration

import (
	"testing"

	"code.vikunja.io/api/pkg/db"
	"code.vikunja.io/api/pkg/models"

	"github.com/stretchr/testify/require"
	"xorm.io/xorm"
	"xorm.io/xorm/schemas"
)

type tasksBefore20261102150726 struct {
	ID        int64  `xorm:"bigint autoincr not null unique pk"`
	Title     string `xorm:"TEXT not null"`
	ProjectID int64  `xorm:"bigint INDEX not null unique(tasks_project_index)"`
	Index     int64  `xorm:"bigint not null default 0 unique(tasks_project_index)"`
	Done      bool   `xorm:"INDEX null"`
}

func (tasksBefore20261102150726) TableName() string {
	return "tasks"
}

type tasksAfter20261102150726 struct {
	ID                int64  `xorm:"bigint autoincr not null unique pk"`
	Title             string `xorm:"TEXT not null"`
	EstimatedDuration *int64 `xorm:"bigint null default 0"`
}

func (tasksAfter20261102150726) TableName() string {
	return "tasks"
}

func TestAddTaskEstimatedDuration20261102150726(t *testing.T) {
	x, err := db.CreateTestEngine()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, x.DropTables("tasks"))
		require.NoError(t, x.Sync2(&models.Task{}))
	})
	require.NoError(t, x.DropTables("tasks"))
	require.NoError(t, x.Sync2(tasksBefore20261102150726{}))

	existing := &tasksBefore20261102150726{Title: "existing", ProjectID: 1, Index: 1}
	_, err = x.Insert(existing)
	require.NoError(t, err)

	before := tasksTable20261102150726(t, x)
	require.NotEmpty(t, before.Indexes)

	require.NoError(t, addTaskEstimatedDuration20261102150726(x))

	after := tasksTable20261102150726(t, x)
	require.NotNil(t, after.GetColumn("estimated_duration"))
	for _, column := range before.ColumnsSeq() {
		require.NotNilf(t, after.GetColumn(column), "migration dropped column %s", column)
	}
	for name, index := range before.Indexes {
		preserved, found := after.Indexes[name]
		require.Truef(t, found, "migration dropped index %s", name)
		require.Equal(t, index.Type, preserved.Type)
		require.Equal(t, index.Cols, preserved.Cols)
	}

	// Existing rows must read as 0 (no estimate), not NULL, so numeric filters treat them consistently.
	got := &tasksAfter20261102150726{}
	found, err := x.ID(existing.ID).Get(got)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "existing", got.Title)
	require.NotNil(t, got.EstimatedDuration)
	require.Equal(t, int64(0), *got.EstimatedDuration)
}

func tasksTable20261102150726(t *testing.T, x *xorm.Engine) *schemas.Table {
	t.Helper()
	tables, err := x.DBMetas()
	require.NoError(t, err)
	for _, table := range tables {
		if table.Name == "tasks" {
			return table
		}
	}
	t.Fatal("tasks table not found")
	return nil
}
