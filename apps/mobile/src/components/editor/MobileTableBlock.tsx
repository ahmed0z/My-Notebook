import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { TableBlockContent } from '@notebook/shared';
import { useTheme } from '../../context/ThemeContext';

interface MobileTableBlockProps {
  content: TableBlockContent;
  onChange: (updated: TableBlockContent) => void;
}

export const MobileTableBlock: React.FC<MobileTableBlockProps> = ({ content, onChange }) => {
  const { colors } = useTheme();
  const columns = content?.columns?.length ? content.columns : ['Col 1', 'Col 2'];
  const rows = content?.rows?.length ? content.rows : [['', '']];

  const updateColumnName = (colIndex: number, text: string) => {
    const newCols = [...columns];
    newCols[colIndex] = text;
    onChange({ ...content, columns: newCols, rows });
  };

  const updateCell = (rowIndex: number, colIndex: number, text: string) => {
    const newRows = rows.map((r, ri) =>
      ri === rowIndex ? r.map((c, ci) => (ci === colIndex ? text : c)) : r
    );
    onChange({ ...content, columns, rows: newRows });
  };

  const addColumn = () => {
    const newCols = [...columns, `Col ${columns.length + 1}`];
    const newRows = rows.map(r => [...r, '']);
    const newColWidths = content.columnWidths ? [...content.columnWidths, 110] : undefined;
    onChange({ ...content, columns: newCols, rows: newRows, columnWidths: newColWidths });
  };

  const addRow = () => {
    const newRow = new Array(columns.length).fill('');
    const newRowHeights = content.rowHeights ? [...content.rowHeights, 36] : undefined;
    onChange({ ...content, columns, rows: [...rows, newRow], rowHeights: newRowHeights });
  };

  const deleteColumn = (colIndex: number) => {
    if (columns.length <= 1) return;
    const newCols = columns.filter((_, ci) => ci !== colIndex);
    const newRows = rows.map(r => r.filter((_, ci) => ci !== colIndex));
    const newColWidths = content.columnWidths ? content.columnWidths.filter((_, ci) => ci !== colIndex) : undefined;
    onChange({ ...content, columns: newCols, rows: newRows, columnWidths: newColWidths });
  };

  const deleteRow = (rowIndex: number) => {
    if (rows.length <= 1) return;
    const newRows = rows.filter((_, ri) => ri !== rowIndex);
    const newRowHeights = content.rowHeights ? content.rowHeights.filter((_, ri) => ri !== rowIndex) : undefined;
    onChange({ ...content, columns, rows: newRows, rowHeights: newRowHeights });
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={[styles.table, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.headerRow, { backgroundColor: colors.inputBg, borderBottomColor: colors.border }]}>
            {columns.map((col, ci) => (
              <View key={ci} style={[styles.headerCell, { borderRightColor: colors.border }]}>
                <TextInput
                  style={[styles.headerInput, { color: colors.text }]}
                  value={col}
                  placeholder={`Col ${ci + 1}`}
                  placeholderTextColor={colors.textMuted}
                  onChangeText={(text) => updateColumnName(ci, text)}
                />
                {columns.length > 1 && (
                  <TouchableOpacity
                    onPress={() => deleteColumn(ci)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.deleteColBtn}
                    accessibilityLabel={`Delete column ${col || ci + 1}`}
                  >
                    <Text style={[styles.deleteBtnText, { color: colors.textMuted }]}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity
              onPress={addColumn}
              style={[styles.addColBtn, { borderRightColor: colors.border }]}
              accessibilityLabel="Add column"
            >
              <Text style={[styles.btnText, { color: colors.textMuted }]}>+ Col</Text>
            </TouchableOpacity>
            <View style={styles.actionColHeader} />
          </View>

          {/* Rows */}
          {rows.map((row, ri) => (
            <View key={ri} style={[styles.row, { borderBottomColor: colors.border }]}>
              {row.map((cell, ci) => (
                <View key={ci} style={[styles.cell, { borderRightColor: colors.border }]}>
                  <TextInput
                    style={[styles.cellInput, { color: colors.text }]}
                    value={cell}
                    placeholder="Empty"
                    placeholderTextColor={colors.textMuted}
                    onChangeText={(text) => updateCell(ri, ci, text)}
                  />
                </View>
              ))}
              <View style={[styles.addColSpacer, { borderRightColor: colors.border }]} />
              <View style={styles.deleteRowCell}>
                {rows.length > 1 && (
                  <TouchableOpacity
                    onPress={() => deleteRow(ri)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.deleteRowBtn}
                    accessibilityLabel={`Delete row ${ri + 1}`}
                  >
                    <Text style={[styles.deleteBtnText, { color: colors.textMuted }]}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Action buttons below table */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          onPress={addRow}
          style={[styles.actionBtn, { borderColor: colors.border }]}
          accessibilityLabel="Add row"
        >
          <Text style={[styles.btnText, { color: colors.textMuted }]}>+ Add Row</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  table: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    alignItems: 'stretch',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    alignItems: 'stretch',
  },
  headerCell: {
    width: 110,
    borderRightWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  cell: {
    width: 110,
    borderRightWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  headerInput: {
    flex: 1,
    fontWeight: '600',
    fontSize: 12,
    padding: 2,
  },
  cellInput: {
    fontSize: 12,
    padding: 2,
  },
  deleteColBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  deleteRowCell: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteRowBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  addColBtn: {
    width: 50,
    borderRightWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  addColSpacer: {
    width: 50,
    borderRightWidth: 1,
  },
  actionColHeader: {
    width: 32,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
