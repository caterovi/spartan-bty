/**
 * Shared department-level authorization middleware.
 * Consolidates the identical department RBAC logic that was previously
 * duplicated in the cdm, sales, crm, fulfillment, supplychain, marketing,
 * and reports route files (audit Recommendation #3).
 *
 * Business rules (preserved EXACTLY from the previous per-route
 * implementations — this is a refactor, not a policy change):
 *   - Head can READ every department module.
 *   - A specialist can READ only their own department module.
 *   - Only the specialist belonging to a department can WRITE that
 *     department's data; Head is NOT automatically granted department
 *     write access.
 *   - requireHeadOnly restricts a route to the Head role alone.
 *
 * req.user is populated by verifyToken (backend/middleware/auth.js) from
 * the JWT payload, which always includes `role` and `departmentCode`.
 */
function requireDepartmentRead(
  departmentCode,
  message
) {
  return (req, res, next) => {
    const isHead =
      req.user?.role === 'head';

    const isDepartmentSpecialist =
      req.user?.role === 'specialist' &&
      req.user?.departmentCode === departmentCode;

    if (
      !isHead &&
      !isDepartmentSpecialist
    ) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    next();
  };
}

function requireDepartmentWrite(
  departmentCode,
  message
) {
  return (req, res, next) => {
    const isDepartmentSpecialist =
      req.user?.role === 'specialist' &&
      req.user?.departmentCode === departmentCode;

    if (!isDepartmentSpecialist) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    next();
  };
}

function requireHeadOnly(message) {
  return (req, res, next) => {
    if (req.user?.role !== 'head') {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    next();
  };
}

module.exports = {
  requireDepartmentRead,
  requireDepartmentWrite,
  requireHeadOnly,
};
