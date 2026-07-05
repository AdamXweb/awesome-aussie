function indexFields(fields) {
  return new Map(fields.map((field) => [field.name, field]));
}

function cellToText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(cellToText).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return cellToText(value.value ?? value.name ?? value.title ?? "");
  }
  return "";
}

function cellToList(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.map(cellToText).filter(Boolean);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionId(field, value) {
  if (!field || !value || !Array.isArray(field.select_options)) return null;
  const wanted = String(value).trim().toLowerCase();
  const option = field.select_options.find(
    (item) => String(item.value).trim().toLowerCase() === wanted
  );
  return option?.id || null;
}

function setField(payload, fieldsByName, fieldName, value, { multi = false } = {}) {
  const field = fieldsByName.get(fieldName);
  if (!field || value === undefined || value === null) return false;

  if (Array.isArray(field.select_options)) {
    if (multi || field.type === "multiple_select") {
      payload[fieldName] = cellToList(value)
        .map((item) => optionId(field, item))
        .filter(Boolean);
      return true;
    }

    const id = optionId(field, value);
    if (!id) return false;
    payload[fieldName] = id;
    return true;
  }

  payload[fieldName] = value;
  return true;
}

module.exports = {
  cellToList,
  cellToText,
  indexFields,
  optionId,
  setField,
};
