import { useMemo, useState } from "react";

function sortByEmail(collaborators) {
  return [...collaborators].sort((a, b) => String(a.email).localeCompare(String(b.email)));
}

export default function PlanShareModal({
  plan,
  collaborators,
  canManageSharing,
  currentUserEmail,
  onClose,
  onAdd,
  onUpdateRole,
  onRemove,
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const owner = useMemo(() => sortByEmail(collaborators.filter(item => item.role === "owner")), [collaborators]);
  const editors = useMemo(() => sortByEmail(collaborators.filter(item => item.role === "editor")), [collaborators]);
  const viewers = useMemo(() => sortByEmail(collaborators.filter(item => item.role === "viewer")), [collaborators]);

  async function handleAddPerson() {
    const normalized = email.trim().toLowerCase();
    const isValidEmail = /.+@.+\..+/.test(normalized);

    if (!isValidEmail) {
      setError("Enter a valid email address.");
      return;
    }

    try {
      setError("");
      setSuccess("");
      setIsSaving(true);
      await onAdd({ email: normalized, role });
      setEmail("");
      setRole("viewer");
      setSuccess(`${normalized} added as ${role}.`);
    } catch (nextError) {
      setError(nextError.message || "Could not add collaborator.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangeRole(emailAddress, nextRole) {
    try {
      setError("");
      setSuccess("");
      setIsSaving(true);
      await onUpdateRole({ email: emailAddress, role: nextRole });
      setSuccess(`${emailAddress} is now ${nextRole}.`);
    } catch (nextError) {
      setError(nextError.message || "Could not update role.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove(emailAddress) {
    try {
      setError("");
      setSuccess("");
      setIsSaving(true);
      await onRemove({ email: emailAddress });
      setSuccess(`${emailAddress} removed.`);
    } catch (nextError) {
      setError(nextError.message || "Could not remove collaborator.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={event => event.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">Share Plan</div>
        <div style={{ fontSize: 12, marginBottom: 14, color: "var(--color-light-text)" }}>
          {plan?.bride || "Bride"} &amp; {plan?.groom || "Groom"}
        </div>

        {canManageSharing && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
              <input
                className="input-field"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="Add people by email"
                disabled={isSaving}
              />
              <select
                className="input-field"
                value={role}
                onChange={event => setRole(event.target.value)}
                disabled={isSaving}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button className="btn-primary" onClick={handleAddPerson} disabled={isSaving}>
              {isSaving ? "Saving..." : "Add People"}
            </button>
          </>
        )}

        {!canManageSharing && (
          <div className="top-bar-chip" style={{ marginBottom: 12 }}>
            You can view collaborators. Only owner can change sharing.
          </div>
        )}

        {error && <div style={{ color: "#B42318", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ color: "#067647", fontSize: 12, marginBottom: 12 }}>{success}</div>}

        <div style={{ display: "grid", gap: 10, maxHeight: "46vh", overflowY: "auto", marginBottom: 10 }}>
          <RoleSection
            title="Owner"
            items={owner}
            canManageSharing={canManageSharing}
            currentUserEmail={currentUserEmail}
            onChangeRole={handleChangeRole}
            onRemove={handleRemove}
          />
          <RoleSection
            title="Editors"
            items={editors}
            canManageSharing={canManageSharing}
            currentUserEmail={currentUserEmail}
            onChangeRole={handleChangeRole}
            onRemove={handleRemove}
          />
          <RoleSection
            title="Viewers"
            items={viewers}
            canManageSharing={canManageSharing}
            currentUserEmail={currentUserEmail}
            onChangeRole={handleChangeRole}
            onRemove={handleRemove}
          />
        </div>

        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function RoleSection({ title, items, canManageSharing, currentUserEmail, onChangeRole, onRemove }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--color-gold)", marginBottom: 6 }}>
        {title}
      </div>
      {items.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--color-light-text)", marginBottom: 8 }}>None</div>
      )}
      {items.map(item => {
        const isOwner = item.role === "owner";
        const isMe = String(item.email).toLowerCase() === String(currentUserEmail || "").toLowerCase();
        return (
          <div
            key={item.email}
            style={{
              border: "1px solid rgba(212, 175, 55, 0.2)",
              borderRadius: 8,
              padding: "8px 10px",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--color-crimson)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.email}
              </div>
              {isMe && <div style={{ fontSize: 11, color: "var(--color-light-text)" }}>You</div>}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {!isOwner && canManageSharing && (
                <select
                  className="input-field"
                  style={{ minWidth: 90, padding: "4px 8px", height: 34 }}
                  value={item.role}
                  onChange={event => onChangeRole(item.email, event.target.value)}
                >
                  <option value="editor">editor</option>
                  <option value="viewer">viewer</option>
                </select>
              )}
              {isOwner && (
                <span className="share-role-badge share-role-badge-owner">Owner</span>
              )}
              {!isOwner && canManageSharing && (
                <button
                  type="button"
                  onClick={() => onRemove(item.email)}
                  className="share-revoke-btn"
                >
                  Revoke Access
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
