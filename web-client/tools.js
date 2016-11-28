function map(value, curr_min, curr_max, new_min, new_max) {
	c_range = curr_max - curr_min;
	n_range = new_max - new_min;
	return (((value - curr_min) * n_range) / c_range) + new_min;
}