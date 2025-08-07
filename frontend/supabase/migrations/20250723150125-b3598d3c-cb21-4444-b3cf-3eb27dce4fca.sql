-- Create fiscal_alerts table
CREATE TABLE public.fiscal_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  country TEXT NOT NULL,
  source TEXT NOT NULL,
  published_date DATE NOT NULL,
  ai_summary TEXT NOT NULL,
  ai_impact_analysis TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.fiscal_alerts ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (since this is for public viewing)
CREATE POLICY "Fiscal alerts are publicly viewable" 
ON public.fiscal_alerts 
FOR SELECT 
USING (true);

-- Create index for better performance on common queries
CREATE INDEX idx_fiscal_alerts_country ON public.fiscal_alerts(country);
CREATE INDEX idx_fiscal_alerts_published_date ON public.fiscal_alerts(published_date DESC);
CREATE INDEX idx_fiscal_alerts_country_date ON public.fiscal_alerts(country, published_date DESC);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_fiscal_alerts_updated_at
BEFORE UPDATE ON public.fiscal_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();