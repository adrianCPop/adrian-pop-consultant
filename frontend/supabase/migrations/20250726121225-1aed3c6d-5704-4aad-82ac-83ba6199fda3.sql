-- Create trigger to automatically update research_done status
CREATE TRIGGER trigger_set_research_done
  AFTER INSERT ON advanced_research
  FOR EACH ROW
  EXECUTE FUNCTION set_research_done();