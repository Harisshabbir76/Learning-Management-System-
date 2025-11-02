const formatSchoolUrl = (req, res, next) => {
  if (req.params.schoolName) {
    req.params.schoolName = req.params.schoolName.replace(/-/g, ' ');
  }
  next();
};

module.exports = formatSchoolUrl;