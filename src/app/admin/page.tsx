export default function AdminPage() {
  return (
    <div className="page">
      {/* Tabs */}
      <div className="tabs">
        <div className="tab active" data-tab="1" id="tab1">Data Types</div>
        <div className="tab" data-tab="2" id="tab2">Fields</div>
        <div className="tab" data-tab="4" id="tab4">Option Sets</div>
        <div className="tab" data-tab="3" id="tab3">Users</div>
      </div>

      {/* Panels */}
      <div className="tab-content panels">
        {/* 1: Data Types */}
        <div className="content panel active" data-content="1" id="content1">
          <section className="full-width">
            <h2>Data Types</h2>
            <ul id="datatype-list" className="simpleList"></ul>
            <input type="hidden" id="selected-datatype-id" />
            <form id="new-data-type-form" className="formRow">
              <label htmlFor="new-data-type" className="label">New Type</label>
              <input type="text" id="new-data-type" className="input" required />
              <button type="submit" className="primaryBtn">Create New Type</button>
            </form>
          </section>
        </div>

        {/* 2: Fields */}
        <div className="content panel" data-content="2" id="content2">
          <h2>
            Fields for <span id="type-name" className="strong">Nothing selected</span>
          </h2>

          <div id="field-context" className="context" style={{ display: "none" }}>
            Editing/Adding fields for: <strong id="field-context-name"></strong>
          </div>

          <table id="fields-table" className="table">
            <thead>
              <tr>
                <th style={{ width: "60%" }}>Field name</th>
                <th style={{ width: "30%" }}>Type</th>
                <th style={{ width: "10%", textAlign: "right" }}>&nbsp;</th>
              </tr>
            </thead>
            <tbody id="fields-tbody"></tbody>
          </table>

          <div id="option-set-picker" style={{ display: "none", marginTop: 8 }}>
            <label htmlFor="option-set-select" className="label">Option Set</label>
            <select id="option-set-select" className="select">
              <option value="">Select an option set</option>
            </select>
          </div>

          <button id="btn-show-field-form" className="secondaryBtn" disabled>
            Add Field
          </button>

          <form id="field-form" className="fieldForm" style={{ display: "none" }}>
            <div className="inputGroup">
              <label htmlFor="new-field" className="label">New Field</label>
              <input type="text" id="new-field" className="input" placeholder="Enter field name" required />
            </div>

            <div className="inputGroup">
              <label htmlFor="field-type" className="label">Type</label>
              <select id="field-type" className="select" required>
                <optgroup label="Basic Types">
                  <option value="">Select Type</option>
                  <option value="Text">Text</option>
                  <option value="Number">Number</option>
                  <option value="Number Range">Number Range</option>
                  <option value="Date">Date</option>
                  <option value="Date Range">Date Range</option>
                  <option value="Time">Time</option>
                  <option value="Geographic Address">Geographic Address</option>
                  <option value="Yes/No">Yes/No</option>
                  <option value="Image">Image</option>
                  <option value="Boolean">Boolean</option>
                  <option value="File">File</option>
                  <option value="Dropdown">Dropdown</option>
                  <option value="Date/Time">Date/Time</option>
                  <option value="Text/Multi-line">Text/Multi-line</option>
                </optgroup>
                <optgroup label="Reference Types" id="reference-options" />
                <optgroup label="Option Sets" id="option-sets-options">
                  <option disabled>Loading…</option>
                </optgroup>
              </select>
            </div>

            <label className="checkboxRow">
              <input type="checkbox" id="allow-multiple" />
              Allow multiple values (e.g. list of items)
            </label>

            <div className="rowGap">
              <button type="submit" className="primaryBtn">Save Field</button>
              <button type="button" id="btn-cancel-field" className="secondaryBtn">Cancel</button>
            </div>
          </form>
        </div>

        {/* 4: Option Sets */}
        <div className="content panel" data-content="4" id="content4">
          <h2>Option Sets</h2>
          <div className="split">
            <div className="left">
              <form id="optionset-form" className="stack">
                <div className="inputGroup">
                  <label htmlFor="new-optionset" className="label">New Option Set</label>
                  <input type="text" id="new-optionset" className="input" placeholder="e.g., UserRoles" required />
                </div>

                <div className="inputGroup">
                  <label htmlFor="optionset-kind-create" className="label">Kind</label>
                  <select id="optionset-kind-create" className="select" required>
                    <optgroup label="Basic Kinds">
                      <option value="text" defaultValue="text">Text</option>
                      <option value="number">Number</option>
                      <option value="boolean">Yes/No</option>
                      <option value="image">Image</option>
                      <option value="color">Color</option>
                    </optgroup>
                  </select>
                </div>

                <button type="submit" className="primaryBtn">Create Set</button>
              </form>

              <ul id="optionset-list" className="simpleList"></ul>
            </div>

            <div className="right" id="optionset-detail" style={{ display: "none" }}>
              <h3>Editing Set</h3>

              <div className="rowWrap" style={{ marginBottom: 8 }}>
                <input type="text" id="optionset-name-input" className="input" style={{ width: 260 }} />
                <button id="optionset-rename-btn" className="secondaryBtn">Rename</button>
                <button id="optionset-delete-btn" className="dangerBtn">Delete Set</button>
              </div>

              <div className="rowWrap" style={{ margin: "8px 0" }}>
                <label htmlFor="optionset-kind" className="label">Kind</label>
                <select id="optionset-kind" className="select">
                  <optgroup label="Basic Kinds">
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Yes/No</option>
                    <option value="image">Image</option>
                    <option value="color">Color</option>
                  </optgroup>
                </select>
                <button id="optionset-kind-save" className="secondaryBtn">Save Kind</button>
              </div>

              <input type="hidden" id="selected-optionset-id" />

              <table id="optionvalues-table" className="table">
                <thead>
                  <tr>
                    <th style={{ width: "40%" }}>Label</th>
                    <th style={{ width: "30%" }}>Meta</th>
                    <th style={{ width: "10%" }}>Order</th>
                    <th style={{ width: "20%", textAlign: "right" }}>&nbsp;</th>
                  </tr>
                </thead>
                <tbody id="optionvalues-tbody"></tbody>
              </table>

              <form id="optionvalue-form" className="stack" style={{ marginTop: 10 }}>
                <label className="label">Label</label>
                <input type="text" id="ov-label" className="input" required />

                <div id="ov-meta-image" style={{ display: "none" }}>
                  <label className="label">Image URL</label>
                  <input type="text" id="ov-imageUrl" className="input" />
                </div>

                <div id="ov-meta-number" style={{ display: "none" }}>
                  <label className="label">Number</label>
                  <input type="number" id="ov-numberValue" className="input" />
                </div>

                <div id="ov-meta-boolean" style={{ display: "none" }}>
                  <label className="label">Boolean</label>
                  <input type="checkbox" id="ov-boolValue" />
                </div>

                <div id="ov-meta-color" style={{ display: "none" }}>
                  <label className="label">Color</label>
                  <input type="color" id="ov-colorHex" className="colorInput" defaultValue="#000000" />
                </div>

                <label className="label" style={{ display: "none" }}>Order</label>
                <input type="number" id="ov-order" defaultValue={0} style={{ display: "none" }} />

                <button type="submit" className="primaryBtn">Add Value</button>
              </form>
            </div>
          </div>
        </div>

        {/* 3: Users */}
        <div className="content panel" data-content="3" id="content3">
          <h2>Users</h2>
          <table id="userTable" className="table">
            <thead>
              <tr>
                <th>First Name</th><th>Last Name</th><th>Email</th><th>Role</th><th>Action</th><th>Businesses</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
